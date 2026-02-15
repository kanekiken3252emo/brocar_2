"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, Grid3x3, List, Loader2, ArrowLeft, Filter, ChevronDown } from "lucide-react";
import { bergClient } from "@/lib/bergClient";
import ItemCard from "@/components/Items/ItemCard";
import { Button } from "@/components/ui/button";
import type { BergResource } from "@/types/berg-api";

function CatalogContent() {
  const searchParams = useSearchParams();
  
  const vin = searchParams?.get("vin");
  const article = searchParams?.get("article");
  const brand = searchParams?.get("brand");
  const model = searchParams?.get("model");
  const categoryParam = searchParams?.get("category");

  const [products, setProducts] = useState<BergResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  
  const [brandFilter, setBrandFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"price-asc" | "price-desc" | "name">("price-asc");
  const [showAnalogs, setShowAnalogs] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    loadProducts();
  }, [vin, article, brand, model, showAnalogs]);

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      let response;

      if (vin) {
        response = await bergClient.searchByVIN(vin);
      } else if (article) {
        response = await bergClient.searchByArticle(article, {
          brandName: brand || undefined,
          analogs: showAnalogs,
        });
      } else if (brand && model) {
        response = await bergClient.searchByArticle("", {
          brandName: brand,
          analogs: true,
        });
      } else {
        setProducts([]);
        setLoading(false);
        return;
      }

      setProducts(response.resources || []);
    } catch (err: any) {
      console.error("Catalog load error:", err);
      setError(err.message || "Не удалось загрузить товары");
    } finally {
      setLoading(false);
    }
  };

  const availableBrands = Array.from(
    new Set(products.map((p) => p.brand?.name).filter(Boolean))
  ).sort();

  const filteredProducts = products.filter((product) => {
    if (brandFilter && product.brand?.name !== brandFilter) {
      return false;
    }
    return true;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case "price-asc":
        const priceA = a.offers?.[0]?.price || Infinity;
        const priceB = b.offers?.[0]?.price || Infinity;
        return priceA - priceB;
      case "price-desc":
        const priceA2 = a.offers?.[0]?.price || 0;
        const priceB2 = b.offers?.[0]?.price || 0;
        return priceB2 - priceA2;
      case "name":
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });

  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);
  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getSearchSummary = () => {
    if (vin) return `Поиск по VIN: ${vin}`;
    if (article) return `Поиск по артикулу: ${article}`;
    if (brand && model) return `${brand} ${model}`;
    if (brand) return `Бренд: ${brand}`;
    return "Каталог запчастей";
  };

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-orange-500 hover:text-orange-400 mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Вернуться на главную
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            {getSearchSummary()}
          </h1>
          {filteredProducts.length > 0 && (
            <p className="text-neutral-400">
              Найдено товаров: <span className="text-white font-semibold">{filteredProducts.length}</span>
            </p>
          )}
        </div>

        {/* Filters and Controls */}
        {products.length > 0 && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 mb-8">
            <div className="flex flex-wrap items-end gap-4">
              {/* Brand Filter */}
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
                      {availableBrands.map((brand) => (
                        <option key={brand} value={brand}>
                          {brand}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Sort */}
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
                    <option value="name">По названию</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 pointer-events-none" />
                </div>
              </div>

              {/* Show Analogs */}
              <div className="flex items-center">
                <label className="flex items-center gap-3 cursor-pointer bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 hover:border-orange-500/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={showAnalogs}
                    onChange={(e) => setShowAnalogs(e.target.checked)}
                    className="w-5 h-5 rounded bg-neutral-700 border-neutral-600 text-orange-500 focus:ring-orange-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-neutral-300">Показать аналоги</span>
                </label>
              </div>

              {/* View Mode */}
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

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-orange-500 mb-4" />
            <span className="text-lg text-neutral-400">Загрузка товаров...</span>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <Button onClick={loadProducts} variant="destructive">
              Попробовать снова
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && products.length === 0 && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center">
            <div className="w-20 h-20 bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Search className="w-10 h-10 text-neutral-600" />
            </div>
            <h3 className="text-2xl font-semibold text-white mb-3">
              Товары не найдены
            </h3>
            <p className="text-neutral-400 mb-8 max-w-md mx-auto">
              Попробуйте изменить параметры поиска или использовать другой артикул
            </p>
            <Link href="/">
              <Button size="lg">
                Вернуться на главную
              </Button>
            </Link>
          </div>
        )}

        {/* Products Grid/List */}
        {!loading && paginatedProducts.length > 0 && (
          <>
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                  : "space-y-4"
              }
            >
              {paginatedProducts.map((product) => (
                <ItemCard key={product.id} resource={product} />
              ))}
            </div>

            {/* Pagination */}
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
                    .filter((page) => {
                      return (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 2 && page <= currentPage + 2)
                      );
                    })
                    .map((page, index, array) => {
                      if (index > 0 && page - array[index - 1] > 1) {
                        return (
                          <span key={`ellipsis-${page}`} className="px-3 py-2.5 text-neutral-500">
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
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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

export default function CatalogPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-neutral-950">
        <Loader2 className="w-12 h-12 animate-spin text-orange-500" />
      </div>
    }>
      <CatalogContent />
    </Suspense>
  );
}
