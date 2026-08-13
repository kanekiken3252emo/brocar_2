"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Loader2, Tag, Layers } from "lucide-react";
import ProductImage from "@/components/Items/ProductImage";

type Cross = { brand: string; number: string; name: string };

const INITIAL = 40; // сколько показываем сразу (остальные — по кнопке)

/**
 * Аналоги/кроссы по OEM-номеру из базы Laximo.DOC. Тянет /api/laximo/crosses
 * (кэш 24ч на сервере) и показывает заменители других брендов с переходом в цены.
 */
export function LaximoCrosses({
  article,
  brand,
}: {
  article: string;
  brand?: string;
}) {
  const [crosses, setCrosses] = useState<Cross[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!article) return;
    let alive = true;
    setLoading(true);
    setShowAll(false);
    const url = `/api/laximo/crosses?oem=${encodeURIComponent(article)}${
      brand ? `&brand=${encodeURIComponent(brand)}` : ""
    }`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive) setCrosses(d?.crosses ?? []);
      })
      .catch(() => {
        if (alive) setCrosses([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [article, brand]);

  if (loading) {
    return (
      <div className="mt-12 flex items-center gap-2 text-sm text-neutral-500">
        <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
        Ищем аналоги по каталогу…
      </div>
    );
  }
  if (!crosses || crosses.length === 0) return null;

  const visible = showAll ? crosses : crosses.slice(0, INITIAL);

  return (
    <div className="mt-12">
      <h2 className="mb-2 flex items-center gap-2 text-2xl font-bold text-white">
        <Layers className="h-6 w-6 text-orange-500" />
        Аналоги ({crosses.length})
      </h2>
      <p className="mb-6 text-sm text-neutral-400">
        Заменители по каталогу Laximo. Нажмите «Цены», чтобы найти вариант у
        поставщиков.
      </p>
      {/* Карточки в том же оформлении, что «Аналоги искомого бренда»:
          фото (лениво, только в зоне видимости), бренд, артикул, название.
          Цен здесь нет — их узнаём по кнопке (373 запроса цен разом нельзя). */}
      <div className="grid gap-3 sm:grid-cols-2">
        {visible.map((c, i) => (
          <div
            key={`${c.brand}-${c.number}-${i}`}
            className="group flex items-start gap-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-orange-500/40"
          >
            <ProductImage
              brand={c.brand}
              article={c.number}
              alt={c.name || c.number}
              className="h-20 w-20 shrink-0 rounded-xl"
              innerPadding="p-2"
              sizes="80px"
            />
            <div className="flex min-w-0 flex-1 flex-col self-stretch">
              <div className="mb-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-sm font-bold uppercase tracking-wide text-orange-500">
                  {c.brand || "Без бренда"}
                </span>
                <span className="rounded-md bg-neutral-800 px-2 py-0.5 font-mono text-sm font-bold text-white">
                  {c.number}
                </span>
              </div>
              <p className="line-clamp-2 break-words text-sm text-neutral-100">
                {c.name || "Деталь-аналог"}
              </p>
              <div className="mt-auto pt-2">
                <Link href={`/catalog?article=${encodeURIComponent(c.number)}`}>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Tag className="h-3.5 w-3.5" />
                    Цены и наличие
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
      {!showAll && crosses.length > INITIAL && (
        <div className="mt-4 text-center">
          <Button variant="outline" onClick={() => setShowAll(true)}>
            Показать все аналоги ({crosses.length})
          </Button>
        </div>
      )}
    </div>
  );
}
