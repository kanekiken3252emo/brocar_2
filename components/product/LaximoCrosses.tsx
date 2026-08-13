"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Loader2, Layers, ChevronRight } from "lucide-react";
import ProductImage from "@/components/Items/ProductImage";

type Cross = { brand: string; number: string; name: string };
type CrossPrice = {
  minPrice: number | null;
  totalStock: number;
  offerCount: number;
};

const INITIAL = 12; // сколько показываем сразу (остальные — по кнопке)
const PRICE_LIMIT = 24; // для скольких первых карточек тянем живую цену

/** Артикул без разделителей — для сравнения с товарами поставщиков. */
const normArt = (s: string) => s.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

// ── Живые цены для карточек: очередь не шире 3 запросов + кэш на сессию ─────
let inflight = 0;
const priceWaiters: Array<() => void> = [];
async function withPriceSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (inflight >= 3)
    await new Promise<void>((resolve) => priceWaiters.push(resolve));
  inflight++;
  try {
    return await fn();
  } finally {
    inflight--;
    priceWaiters.shift()?.();
  }
}
const priceCache = new Map<string, CrossPrice>();

/** Бейдж «от X ₽ · N шт.» — сервер кэширует ответ на 6ч, клиент на сессию. */
function CrossPriceTag({
  article,
  brand,
  eager,
}: {
  article: string;
  brand: string;
  eager: boolean;
}) {
  const cacheKey = `${brand}|${article}`;
  const [info, setInfo] = useState<CrossPrice | null | undefined>(() =>
    priceCache.get(cacheKey)
  );

  useEffect(() => {
    if (!eager || info !== undefined) return;
    let alive = true;
    setInfo(null); // загрузка
    void withPriceSlot(async () => {
      try {
        const r = await fetch(
          `/api/cross-price?article=${encodeURIComponent(
            article
          )}&brand=${encodeURIComponent(brand)}`
        );
        const d: CrossPrice = r.ok
          ? await r.json()
          : { minPrice: null, totalStock: 0, offerCount: 0 };
        priceCache.set(cacheKey, d);
        if (alive) setInfo(d);
      } catch {
        if (alive) setInfo({ minPrice: null, totalStock: 0, offerCount: 0 });
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eager, article, brand]);

  if (!eager && info === undefined) return null;
  if (info === null || info === undefined) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
        <Loader2 className="h-3 w-3 animate-spin" />
        цену уточняем…
      </span>
    );
  }
  if (info.minPrice === null) {
    return <span className="text-xs text-neutral-500">под заказ</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="text-base font-bold text-white">
        от {info.minPrice.toLocaleString("ru-RU")}{" "}
        <span className="text-sm font-normal text-neutral-500">₽</span>
      </span>
      <span className="text-xs text-green-400">
        {info.totalStock} шт. · {info.offerCount} предл.
      </span>
    </span>
  );
}

/**
 * Аналоги/кроссы по OEM-номеру из базы Laximo.DOC. Тянет /api/laximo/crosses
 * (кэш 24ч на сервере) и показывает заменители в том же оформлении карточек,
 * что «Аналоги в наличии» (SupplierGroupListItem): фото, бренд, артикул.
 *
 * excludeArticles — артикулы, уже показанные выше с ценами (аналоги от
 * поставщиков + сам товар): их не дублируем.
 */
export function LaximoCrosses({
  article,
  brand,
  excludeArticles = [],
}: {
  article: string;
  brand?: string;
  excludeArticles?: string[];
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

  // Что уже показано выше с ценами — из каталожного списка убираем.
  const visible = useMemo(() => {
    if (!crosses) return [];
    const seen = new Set(excludeArticles.map(normArt));
    seen.add(normArt(article));
    return crosses.filter((c) => !seen.has(normArt(c.number)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crosses, excludeArticles.join("|"), article]);

  if (loading) {
    return (
      <div className="mt-12 flex items-center gap-2 text-sm text-neutral-500">
        <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
        Ищем аналоги по каталогу…
      </div>
    );
  }
  if (visible.length === 0) return null;

  const hasSupplierBlock = excludeArticles.length > 0;
  const shown = showAll ? visible : visible.slice(0, INITIAL);

  return (
    <div className="mt-12">
      <h2 className="mb-2 flex items-center gap-2 text-2xl font-bold text-white">
        <Layers className="h-6 w-6 text-orange-500" />
        {hasSupplierBlock
          ? `Ещё аналоги из каталога (${visible.length})`
          : `Аналоги (${visible.length})`}
      </h2>
      <p className="mb-6 text-sm text-neutral-400">
        Заменители по каталогу Laximo. Нажмите на карточку — проверим цены и
        наличие у поставщиков.
      </p>
      <div className="space-y-4">
        {shown.map((c, i) => (
          <Link
            key={`${c.brand}-${c.number}-${i}`}
            href={`/catalog?article=${encodeURIComponent(c.number)}`}
            className="group block overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 transition-colors hover:border-orange-500/40"
          >
            {/* Шапка карточки — как у SupplierGroupListItem */}
            <div className="flex items-start gap-4 p-4 transition-colors group-hover:bg-neutral-800/30 md:p-5">
              <ProductImage
                brand={c.brand}
                article={c.number}
                alt={c.name || c.number}
                className="h-20 w-20 shrink-0 rounded-xl md:h-24 md:w-24"
                innerPadding="p-2"
                sizes="96px"
              />
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-sm font-bold uppercase tracking-wide text-orange-500">
                    {c.brand || "Без бренда"}
                  </span>
                  <span className="rounded-md bg-neutral-800 px-2 py-0.5 font-mono text-base font-bold text-white">
                    {c.number}
                  </span>
                </div>
                <h3 className="line-clamp-2 break-words text-base text-neutral-100 transition-colors group-hover:text-orange-400">
                  {c.name || "Деталь-аналог"}
                </h3>
                <div className="mt-2">
                  <CrossPriceTag
                    article={c.number}
                    brand={c.brand}
                    eager={i < PRICE_LIMIT}
                  />
                </div>
              </div>
              <ChevronRight className="ml-auto h-5 w-5 shrink-0 self-center text-neutral-600 transition-colors group-hover:text-orange-500" />
            </div>
            {/* Низ карточки — вместо таблицы предложений призыв узнать цену */}
            <div className="flex w-full items-center justify-center gap-2 border-t border-neutral-800 bg-neutral-800/30 py-2.5 text-xs font-medium text-neutral-400 transition-colors group-hover:bg-neutral-800/60 group-hover:text-orange-400">
              Цены и наличие у поставщиков
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </Link>
        ))}
      </div>
      {!showAll && visible.length > INITIAL && (
        <div className="mt-4 text-center">
          <Button variant="outline" onClick={() => setShowAll(true)}>
            Показать все аналоги ({visible.length})
          </Button>
        </div>
      )}
    </div>
  );
}
