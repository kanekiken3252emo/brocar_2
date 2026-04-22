"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Grid3x3,
  List,
  Loader2,
  ArrowLeft,
  ChevronDown,
  Package,
} from "lucide-react";
import { bergClient } from "@/lib/bergClient";
import SupplierItemCard from "@/components/Items/SupplierItemCard";
import SupplierGroupListItem from "@/components/Items/SupplierGroupListItem";
import { Button } from "@/components/ui/button";
import type { SupplierGroup } from "@/lib/suppliers/adapter";
import type { BergResource } from "@/types/berg-api";

interface CategoryHub {
  slug: string;
  title: string;
  count: number;
}

function CatalogContent() {
  const searchParams = useSearchParams();

  const vin = searchParams?.get("vin");
  const article = searchParams?.get("article");
  const brand = searchParams?.get("brand");
  const model = searchParams?.get("model");
  const category = searchParams?.get("category");

  const [groups, setGroups] = useState<SupplierGroup[]>([]);
  const [categoryTitle, setCategoryTitle] = useState<string | null>(null);
  const [categoryHub, setCategoryHub] = useState<CategoryHub[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [brandFilter, setBrandFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<
    "price-asc" | "price-desc" | "name" | "delivery"
  >("price-asc");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vin, article, brand, model, category]);

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    setCategoryTitle(null);
    setCategoryHub(null);

    try {
      if (category) {
        // Каталог из импортированной БД (Berg)
        const res = await fetch(
          `/api/catalog/category/${encodeURIComponent(category)}`
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Ошибка загрузки категории");
        }
        const data: { groups: SupplierGroup[]; title: string } = await res.json();
        setGroups(data.groups || []);
        setCategoryTitle(data.title || null);
      } else if (brand && !model && !article) {
        // Страница марки авто: товары из БД с этой маркой в car_brands
        const res = await fetch(
          `/api/catalog/car-brand/${encodeURIComponent(brand)}`
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Ошибка загрузки");
        }
        const data: { groups: SupplierGroup[]; title: string } = await res.json();
        setGroups(data.groups || []);
        setCategoryTitle(data.title ? `Запчасти для ${data.title}` : null);
      } else if (article) {
        // Мульти-поставщиковый поиск по артикулу
        const res = await fetch("/api/suppliers/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            article,
            ...(brand ? { brand } : {}),
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Ошибка поиска");
        }
        const data: { groups: SupplierGroup[] } = await res.json();
        setGroups(data.groups || []);
      } else if (vin) {
        // VIN ищем только по Berg (Rossko не поддерживает VIN).
        // Конвертируем BergResource → SupplierGroup на лету.
        const response = await bergClient.searchByVIN(vin);
        setGroups(bergResourcesToGroups(response.resources || []));
      } else if (brand && model) {
        const response = await bergClient.searchByArticle("", {
          brandName: brand,
          analogs: true,
        });
        setGroups(bergResourcesToGroups(response.resources || []));
      } else {
        // Нет ни одного параметра — показываем хаб с категориями
        setGroups([]);
        const res = await fetch("/api/catalog/categories");
        if (res.ok) {
          const data: { categories: CategoryHub[] } = await res.json();
          setCategoryHub(data.categories || []);
        }
      }
    } catch (err: any) {
      console.error("Catalog load error:", err);
      setError(err.message || "Не удалось загрузить товары");
    } finally {
      setLoading(false);
    }
  };

  const availableBrands = Array.from(
    new Set(groups.map((g) => g.brand).filter(Boolean))
  ).sort();

  const filtered = groups.filter((g) =>
    brandFilter ? g.brand === brandFilter : true
  );

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "price-asc":
        return a.minPrice - b.minPrice;
      case "price-desc":
        return b.minPrice - a.minPrice;
      case "name":
        return a.name.localeCompare(b.name);
      case "delivery":
        return (a.minDeliveryDays ?? 999) - (b.minDeliveryDays ?? 999);
      default:
        return 0;
    }
  });

  const totalPages = Math.ceil(sorted.length / itemsPerPage);
  const paginated = sorted.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getSearchSummary = () => {
    if (categoryTitle) return categoryTitle;
    if (vin) return `Поиск по VIN: ${vin}`;
    if (article) return `Поиск по артикулу: ${article}`;
    if (brand && model) return `${brand} ${model}`;
    if (brand) return `Бренд: ${brand}`;
    return "Каталог запчастей";
  };

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center text-orange-500 hover:text-orange-400 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Вернуться на главную
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            {getSearchSummary()}
          </h1>
          {filtered.length > 0 && (
            <p className="text-neutral-400">
              Найдено товаров:{" "}
              <span className="text-white font-semibold">
                {filtered.length}
              </span>
            </p>
          )}
        </div>

        {groups.length > 0 && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 mb-8">
            <div className="flex flex-wrap items-end gap-4">
              {availableBrands.length > 1 && (
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-neutral-400 mb-2">
                    Производитель
                  </label>
                  <div className="relative">
                    <select
                      value={brandFilter}
                      onChange={(e) => setBrandFilter(e.target.value)}
                      className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white appearance-none focus:border-orange-500 focus:outline-none transition-colors"
                    >
                      <option value="">Все производители</option>
                      {availableBrands.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 pointer-events-none" />
                  </div>
                </div>
              )}

              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-neutral-400 mb-2">
                  Сортировка
                </label>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white appearance-none focus:border-orange-500 focus:outline-none transition-colors"
                  >
                    <option value="price-asc">Цена: по возрастанию</option>
                    <option value="price-desc">Цена: по убыванию</option>
                    <option value="delivery">По сроку доставки</option>
                    <option value="name">По названию</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 pointer-events-none" />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-3 rounded-xl transition-colors ${
                    viewMode === "grid"
                      ? "bg-orange-500 text-white"
                      : "bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-700"
                  }`}
                  title="Сетка"
                >
                  <Grid3x3 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-3 rounded-xl transition-colors ${
                    viewMode === "list"
                      ? "bg-orange-500 text-white"
                      : "bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-700"
                  }`}
                  title="Список"
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-orange-500 mb-4" />
            <span className="text-lg text-neutral-400">Загрузка товаров...</span>
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <Button onClick={loadProducts} variant="destructive">
              Попробовать снова
            </Button>
          </div>
        )}

        {!loading && !error && groups.length === 0 && categoryHub && categoryHub.length > 0 && (
          <div>
            <div className="mb-6">
              <p className="text-neutral-400">
                Выберите категорию запчастей
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {categoryHub.map((c) => (
                <Link
                  key={c.slug}
                  href={`/catalog?category=${encodeURIComponent(c.slug)}`}
                  className="group bg-neutral-900 border border-neutral-800 rounded-2xl p-5 hover:border-orange-500/50 transition-all hover:shadow-lg hover:shadow-orange-500/10"
                >
                  <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-orange-500/20 transition-colors">
                    <Package className="w-6 h-6 text-orange-500" />
                  </div>
                  <div className="text-lg font-bold text-white group-hover:text-orange-400 transition-colors">
                    {c.title}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    {c.count.toLocaleString("ru-RU")} товаров
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && groups.length === 0 && (!categoryHub || categoryHub.length === 0) && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center">
            <div className="w-20 h-20 bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Search className="w-10 h-10 text-neutral-600" />
            </div>
            <h3 className="text-2xl font-semibold text-white mb-3">
              Товары не найдены
            </h3>
            <p className="text-neutral-400 mb-8 max-w-md mx-auto">
              Попробуйте изменить параметры поиска или использовать другой
              артикул
            </p>
            <Link href="/">
              <Button size="lg">Вернуться на главную</Button>
            </Link>
          </div>
        )}

        {!loading && paginated.length > 0 && (
          <>
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {paginated.map((group) => (
                  <SupplierItemCard
                    key={`${group.article}-${group.brand}`}
                    group={group}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {paginated.map((group) => (
                  <SupplierGroupListItem
                    key={`${group.article}-${group.brand}`}
                    group={group}
                  />
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-12 flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-5 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-300 hover:border-orange-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Назад
                </button>

                <div className="flex gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (page) =>
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 2 && page <= currentPage + 2)
                    )
                    .map((page, index, array) => {
                      if (index > 0 && page - array[index - 1] > 1) {
                        return (
                          <span
                            key={`ellipsis-${page}`}
                            className="px-3 py-2.5 text-neutral-500"
                          >
                            ...
                          </span>
                        );
                      }
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-4 py-2.5 rounded-xl font-medium transition-colors ${
                            currentPage === page
                              ? "bg-orange-500 text-white"
                              : "bg-neutral-800 border border-neutral-700 text-neutral-300 hover:border-orange-500/50"
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                </div>

                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-5 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-300 hover:border-orange-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Вперед
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Конвертирует BergResource[] (ответ VIN-поиска Berg) в SupplierGroup[]
 * с теми же типами, что и общий эндпоинт /api/suppliers/search.
 * Используется только пока Rossko/другие поставщики не поддерживают VIN —
 * после миграции VIN-поиска на серверную часть этот код удалим.
 */
function bergResourcesToGroups(resources: BergResource[]): SupplierGroup[] {
  return resources.map((r) => {
    const offers = (r.offers || []).map((o) => {
      const price = Number(o.price) || 0;
      const markup = Math.round(Math.max(price * 1.15, price + 200));
      return {
        supplier: `Berg (${o.warehouse?.name || "склад"})`,
        supplierCode: "berg",
        price,
        ourPrice: markup,
        stock: Number(o.quantity) || 0,
        deliveryDays:
          o.average_period != null ? Number(o.average_period) : null,
      };
    });

    const prices = offers.map((o) => o.ourPrice).filter((p) => p > 0);
    const stocks = offers.reduce((sum, o) => sum + o.stock, 0);
    const delivery = offers
      .map((o) => o.deliveryDays)
      .filter((d): d is number => d != null);

    return {
      article: r.article || "",
      brand: r.brand?.name || "",
      name: r.name || "",
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      totalStock: stocks,
      minDeliveryDays: delivery.length ? Math.min(...delivery) : null,
      offers: offers.sort((a, b) => a.ourPrice - b.ourPrice),
    };
  });
}

export default function CatalogPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-neutral-950">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500" />
        </div>
      }
    >
      <CatalogContent />
    </Suspense>
  );
}
