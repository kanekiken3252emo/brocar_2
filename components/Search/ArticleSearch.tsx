"use client";

import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { bergClient } from "@/lib/bergClient";
import type { BergResource } from "@/types/berg-api";

interface ArticleSearchProps {
  onResults?: (results: BergResource[]) => void;
}

export default function ArticleSearch({ onResults }: ArticleSearchProps) {
  const [article, setArticle] = useState("");
  const [brand, setBrand] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<BergResource[]>([]);
  const [showAnalogs, setShowAnalogs] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!article.trim()) {
      setError("Введите артикул");
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const response = await bergClient.searchByArticle(article.trim(), {
        brandName: brand.trim() || undefined,
        analogs: showAnalogs,
      });

      if (response.resources && response.resources.length > 0) {
        setResults(response.resources);
        onResults?.(response.resources);
      } else {
        setError("Товары не найдены");
      }
    } catch (err: any) {
      setError(err.message || "Ошибка поиска");
      console.error("Article search error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="flex gap-4">
          {/* Article Input */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Артикул
            </label>
            <input
              type="text"
              value={article}
              onChange={(e) => setArticle(e.target.value.toUpperCase())}
              placeholder="Например: GDB1044"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Brand Input */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Бренд (опционально)
            </label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Например: TRW"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Options */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showAnalogs}
              onChange={(e) => setShowAnalogs(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Показать аналоги</span>
          </label>
        </div>

        {/* Search Button */}
        <button
          type="submit"
          disabled={loading || !article.trim()}
          className="w-full md:w-auto px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Поиск...
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              Найти запчасти
            </>
          )}
        </button>
      </form>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Results Count */}
      {results.length > 0 && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-700 text-sm">
            Найдено товаров: <strong>{results.length}</strong>
          </p>
        </div>
      )}
    </div>
  );
}

