"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Car, Search } from "lucide-react";

export interface CarBrand {
  slug: string;
  title: string;
  count: number;
}

function BrandLogo({ slug, title }: { slug: string; title: string }) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <div className="h-28 bg-neutral-800 flex items-center justify-center">
        <Car className="w-14 h-14 text-orange-500" />
      </div>
    );
  }
  return (
    <div className="h-28 bg-white flex items-center justify-center p-4 transition-colors group-hover:bg-neutral-50">
      <Image
        src={`/brand-logos/${slug}.png`}
        alt={title}
        width={160}
        height={160}
        className="object-contain max-h-full max-w-full"
        onError={() => setErrored(true)}
        unoptimized
      />
    </div>
  );
}

/**
 * Клиентская часть страницы автомарок: только поиск и фильтрация по уже
 * полученному с сервера списку. Сетка марок приходит в первом HTML (initialBrands),
 * клиентского водопада «спиннер → fetch → рендер» больше нет.
 */
export default function AutomarkiClient({
  initialBrands,
}: {
  initialBrands: CarBrand[];
}) {
  const [query, setQuery] = useState("");

  const filtered = query
    ? initialBrands.filter((b) =>
        b.title.toLowerCase().includes(query.toLowerCase())
      )
    : initialBrands;

  return (
    <>
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

      {filtered.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center text-neutral-400">
          {query ? "По запросу ничего не найдено" : "Пока нет марок"}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filtered.map((b) => (
            <Link
              key={b.slug}
              href={`/catalog?brand=${encodeURIComponent(b.slug)}`}
              className="group bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden hover:border-orange-500/50 transition-all hover:shadow-lg hover:shadow-orange-500/10"
            >
              <BrandLogo slug={b.slug} title={b.title} />
              <div className="p-4">
                <div className="text-base font-bold text-white group-hover:text-orange-400 transition-colors">
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
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
