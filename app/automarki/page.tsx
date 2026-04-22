"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Car, Search, Loader2 } from "lucide-react";

interface CarBrand {
  slug: string;
  title: string;
  count: number;
}

export default function AutomarkiPage() {
  const [brands, setBrands] = useState<CarBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/catalog/car-brands")
      .then(async (r) => {
        if (!r.ok) throw new Error("load error");
        return r.json();
      })
      .then((data) => setBrands(data.brands || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = query
    ? brands.filter((b) =>
        b.title.toLowerCase().includes(query.toLowerCase())
      )
    : brands;

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="container mx-auto px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center text-orange-500 hover:text-orange-400 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Вернуться на главную
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            Автомарки
          </h1>
          <p className="text-neutral-400">
            Выберите марку автомобиля — покажем все подходящие запчасти
          </p>
        </div>

        <div className="mb-8 max-w-md">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск марки — BMW, Toyota, Kia…"
              className="w-full pl-12 pr-4 py-3 bg-neutral-900 border border-neutral-800 rounded-xl text-white placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-orange-500 mb-3" />
            <span className="text-neutral-400">Загрузка марок…</span>
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-red-400">
            {error}
          </div>
        )}

        {!loading && filtered.length === 0 && !error && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center text-neutral-400">
            {query ? "По запросу ничего не найдено" : "Пока нет марок"}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filtered.map((b) => (
              <Link
                key={b.slug}
                href={`/catalog?brand=${encodeURIComponent(b.slug)}`}
                className="group bg-neutral-900 border border-neutral-800 rounded-2xl p-5 hover:border-orange-500/50 transition-all hover:shadow-lg hover:shadow-orange-500/10"
              >
                <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-orange-500/20 transition-colors">
                  <Car className="w-6 h-6 text-orange-500" />
                </div>
                <div className="text-lg font-bold text-white group-hover:text-orange-400 transition-colors">
                  {b.title}
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  {b.count.toLocaleString("ru-RU")}{" "}
                  {b.count === 1
                    ? "товар"
                    : b.count < 5
                    ? "товара"
                    : "товаров"}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
