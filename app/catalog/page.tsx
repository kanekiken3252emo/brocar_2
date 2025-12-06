"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, Grid3x3, List, Loader2, ArrowLeft, Filter, SlidersHorizontal } from "lucide-react";
import { bergClient } from "@/lib/bergClient";
import ItemCard from "@/components/Items/ItemCard";
import type { BergResource } from "@/types/berg-api";

function CatalogContent() {
  const searchParams = useSearchParams();
  
  // Get search parameters
  const vin = searchParams?.get("vin");
  const article = searchParams?.get("article");
  const brand = searchParams?.get("brand");
  const model = searchParams?.get("model");
  const categoryParam = searchParams?.get("category");

  const [products, setProducts] = useState<BergResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  
  // Filters
  const [brandFilter, setBrandFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"price-asc" | "price-desc" | "name">("price-asc");
  const [showAnalogs, setShowAnalogs] = useState(false);
  
  // Pagination
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
        // Search by VIN
        response = await bergClient.searchByVIN(vin);
      } else if (article) {
        // Search by article
        response = await bergClient.searchByArticle(article, {
          brandName: brand || undefined,
          analogs: showAnalogs,
        });
      } else if (brand && model) {
        // Search by vehicle (simplified - search by brand)
        response = await bergClient.searchByArticle("", {
          brandName: brand,
          analogs: true,
        });
      } else {
        // No search criteria - show empty state
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

  // Get unique brands from products
  const availableBrands = Array.from(
    new Set(products.map((p) => p.brand?.name).filter(Boolean))
  ).sort();

  // Filter products
  const filteredProducts = products.filter((product) => {
    if (brandFilter && product.brand?.name !== brandFilter) {
      return false;
    }
    return true;
  });

  // Sort products
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

  // Paginate products
  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);
  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Get search summary
  const getSearchSummary = () => {
    if (vin) return `Поиск по VIN: ${vin}`;
    if (article) return `Поиск по артикулу: ${article}`;
    if (brand && model) return `${brand} ${model}`;
    if (brand) return `Бренд: ${brand}`;
    return "Каталог запчастей";
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Вернуться на главную
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">
            {getSearchSummary()}
          </h1>
          {filteredProducts.length > 0 && (
            <p className="text-gray-600 mt-2">
              Найдено товаров: <strong>{filteredProducts.length}</strong>
            </p>
          )}
        </div>

        {/* Filters and Controls */}
        {products.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              {/* Brand Filter */}
              {availableBrands.length > 1 && (
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Производитель
                  </label>
                  <select
                    value={brandFilter}
                    onChange={(e) => setBrandFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Все производители</option>
                    {availableBrands.map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sort */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Сортировка
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="price-asc">Цена: по возрастанию</option>
                  <option value="price-desc">Цена: по убыванию</option>
                  <option value="name">По названию</option>
                </select>
              </div>

              {/* Show Analogs */}
              <div className="flex items-end h-full">
                <label className="flex items-center gap-2 cursor-pointer pb-2">
                  <input
                    type="checkbox"
                    checked={showAnalogs}
                    onChange={(e) => setShowAnalogs(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Показать аналоги</span>
                </label>
              </div>

              {/* View Mode */}
              <div className="flex items-end h-full">
                <div className="flex gap-2 pb-2">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-2 rounded ${
                      viewMode === "grid"
                        ? "bg-blue-100 text-blue-600"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                    title="Сетка"
                  >
                    <Grid3x3 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-2 rounded ${
                      viewMode === "list"
                        ? "bg-blue-100 text-blue-600"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                    title="Список"
                  >
                    <List className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
            <span className="ml-3 text-lg text-gray-600">Загрузка товаров...</span>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-700">{error}</p>
            <button
              onClick={loadProducts}
              className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Попробовать снова
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && products.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Товары не найдены
            </h3>
            <p className="text-gray-600 mb-6">
              Попробуйте изменить параметры поиска или использовать другой артикул
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Вернуться на главную
            </Link>
          </div>
        )}

        {/* Products Grid/List */}
        {!loading && paginatedProducts.length > 0 && (
          <>
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
                  : "space-y-4"
              }
            >
              {paginatedProducts.map((product) => (
                <ItemCard key={product.id} resource={product} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Назад
                </button>
                
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
                        <span key={`ellipsis-${page}`} className="px-2">
                          ...
                        </span>
                      );
                    }
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-4 py-2 rounded-lg ${
                          currentPage === page
                            ? "bg-blue-600 text-white"
                            : "border border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    }>
      <CatalogContent />
    </Suspense>
  );
}
