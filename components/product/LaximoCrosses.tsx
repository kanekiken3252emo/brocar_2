"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Loader2, Tag, Layers } from "lucide-react";

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
      <div className="divide-y divide-neutral-800 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">
        {visible.map((c, i) => (
          <div
            key={`${c.brand}-${c.number}-${i}`}
            className="flex items-center gap-3 p-3.5 transition-colors hover:bg-neutral-800/40"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-100">
                {c.name || c.number}
              </p>
              <p className="text-xs text-neutral-400">
                <span className="font-medium text-orange-400/90">
                  {c.brand}
                </span>{" "}
                · <span className="font-mono">{c.number}</span>
              </p>
            </div>
            <Link
              href={`/catalog?article=${encodeURIComponent(c.number)}`}
              className="shrink-0"
            >
              <Button size="sm" variant="outline" className="gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                Цены
              </Button>
            </Link>
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
