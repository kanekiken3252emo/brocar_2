"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Loader2, Layers, ChevronRight, Search } from "lucide-react";
import ProductImage from "@/components/Items/ProductImage";
import SupplierGroupListItem from "@/components/Items/SupplierGroupListItem";
import type { SupplierGroup } from "@/lib/suppliers/adapter";

type Cross = { brand: string; number: string; name: string };

const INITIAL = 12; // сколько показываем сразу (остальные — по кнопке)
const PRICE_LIMIT = 24; // для скольких первых карточек опрашиваем поставщиков

/** Артикул без разделителей — для сравнения с товарами поставщиков. */
const normArt = (s: string) => s.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

// ── Предложения поставщиков для карточек: очередь не шире 3 запросов + кэш ──
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
// null = проверили, нет у поставщиков; SupplierGroup = есть предложения.
const groupCache = new Map<string, SupplierGroup | null>();

/** Предложения поставщиков для одного кросса (загрузка с лимитом очереди).
 *  undefined = ещё грузится / не проверяли. onResolved дёргает родителя,
 *  чтобы тот пересортировал список (наличие вверх, «под заказ» вниз). */
function useCrossGroup(
  article: string,
  brand: string,
  eager: boolean,
  onResolved?: () => void
): SupplierGroup | null | undefined {
  const cacheKey = `${brand}|${article}`;
  const [group, setGroup] = useState<SupplierGroup | null | undefined>(() =>
    groupCache.has(cacheKey) ? groupCache.get(cacheKey) : undefined
  );

  useEffect(() => {
    if (!eager || group !== undefined || groupCache.has(cacheKey)) return;
    let alive = true;
    void withPriceSlot(async () => {
      try {
        const r = await fetch(
          `/api/cross-price?article=${encodeURIComponent(
            article
          )}&brand=${encodeURIComponent(brand)}`
        );
        const d: { group: SupplierGroup | null } = r.ok
          ? await r.json()
          : { group: null };
        groupCache.set(cacheKey, d.group);
        if (alive) setGroup(d.group);
      } catch {
        groupCache.set(cacheKey, null);
        if (alive) setGroup(null);
      }
      onResolved?.();
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eager, article, brand]);

  return group;
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
  // Поиск по аналогам: мгновенный фильтр списка по бренду/артикулу/названию.
  const [filterQ, setFilterQ] = useState("");
  // Тик пересортировки: каждая завершённая проверка наличия перерисовывает
  // список (в наличии — вверх, «под заказ» — вниз).
  const [, setResolvedTick] = useState(0);

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

  // Фильтр по бренду/артикулу/названию. При активном фильтре показываем ВСЕ
  // совпадения сразу (кнопка «показать все» не нужна).
  const fq = filterQ.trim().toLowerCase();
  const fqArt = normArt(filterQ);
  const matched = fq
    ? visible.filter(
        (c) =>
          c.brand.toLowerCase().includes(fq) ||
          c.name.toLowerCase().includes(fq) ||
          (fqArt && normArt(c.number).includes(fqArt))
      )
    : visible;
  const shown = fq ? matched : showAll ? visible : visible.slice(0, INITIAL);

  // Автопроверку наличия получают первые PRICE_LIMIT карточек ИСХОДНОГО
  // порядка — фиксированный набор, чтобы пересортировка не выстраивала
  // очередь на проверку всех 300+ позиций.
  const eagerKeys = new Set(
    shown.slice(0, PRICE_LIMIT).map((c) => `${c.brand}|${c.number}`)
  );

  // Порядок показа: с наличием — вверх, «под заказ» — вниз, непроверенные —
  // между ними (сортировка стабильная, внутри группы порядок каталога).
  const rank = (c: Cross) => {
    const k = `${c.brand}|${c.number}`;
    if (!groupCache.has(k)) return 1;
    return groupCache.get(k) ? 0 : 2;
  };
  const ordered = [...shown].sort((a, b) => rank(a) - rank(b));

  return (
    <div className="mt-12">
      <h2 className="mb-2 flex items-center gap-2 text-2xl font-bold text-white">
        <Layers className="h-6 w-6 text-orange-500" />
        {hasSupplierBlock
          ? `Ещё аналоги из каталога (${visible.length})`
          : `Аналоги (${visible.length})`}
      </h2>
      <p className="mb-4 text-sm text-neutral-400">
        Заменители по каталогу Laximo. Нажмите на карточку — проверим цены и
        наличие у поставщиков.
      </p>

      {/* Поиск по аналогам — мгновенный фильтр списка (без запросов) */}
      <div className="relative mb-5 max-w-md">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
        <input
          value={filterQ}
          onChange={(e) => setFilterQ(e.target.value)}
          placeholder="Найти аналог: бренд, артикул или название…"
          className="w-full rounded-xl border border-neutral-700 bg-neutral-800 py-2.5 pl-10 pr-4 text-white placeholder:text-neutral-600 transition-colors focus:border-orange-500 focus:outline-none"
        />
      </div>
      {fq && (
        <p className="mb-4 text-sm text-neutral-400">
          {matched.length
            ? `Совпадений: ${matched.length}`
            : "Совпадений нет — попробуйте короче (например, только бренд или часть номера)."}
        </p>
      )}

      <div className="space-y-4">
        {ordered.map((c) => (
          <CrossCard
            key={`${c.brand}-${c.number}`}
            cross={c}
            eager={eagerKeys.has(`${c.brand}|${c.number}`)}
            onResolved={() => setResolvedTick((v) => v + 1)}
          />
        ))}
      </div>
      {!fq && !showAll && visible.length > INITIAL && (
        <div className="mt-4 text-center">
          <Button variant="outline" onClick={() => setShowAll(true)}>
            Показать все аналоги ({visible.length})
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Одна карточка аналога. Если у поставщиков нашлись предложения — рендерим
 * ТОТ ЖЕ SupplierGroupListItem, что в «Аналогах в наличии» (единый формат,
 * корзина прямо из списка). Иначе — справочная карточка каталога.
 */
function CrossCard({
  cross,
  eager,
  onResolved,
}: {
  cross: Cross;
  eager: boolean;
  onResolved?: () => void;
}) {
  const group = useCrossGroup(cross.number, cross.brand, eager, onResolved);

  // Есть в наличии у поставщиков → полная карточка с предложениями.
  if (group) return <SupplierGroupListItem group={group} />;

  const checking = eager && group === undefined;
  return (
    <Link
      href={`/catalog?article=${encodeURIComponent(cross.number)}`}
      className="group block overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 transition-colors hover:border-orange-500/40"
    >
      {/* Шапка — в точности как у SupplierGroupListItem */}
      <div className="flex items-start gap-4 p-4 transition-colors group-hover:bg-neutral-800/30 md:p-5">
        <ProductImage
          brand={cross.brand}
          article={cross.number}
          alt={cross.name || cross.number}
          className="h-20 w-20 shrink-0 rounded-xl md:h-24 md:w-24"
          innerPadding="p-2"
          sizes="96px"
        />
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-sm font-bold uppercase tracking-wide text-orange-500">
              {cross.brand || "Без бренда"}
            </span>
            <span className="rounded-md bg-neutral-800 px-2 py-0.5 font-mono text-base font-bold text-white">
              {cross.number}
            </span>
          </div>
          <h3 className="line-clamp-2 break-words text-base text-neutral-100 transition-colors group-hover:text-orange-400">
            {cross.name || "Деталь-аналог"}
          </h3>
          <div className="mt-2">
            {checking ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                проверяем наличие у поставщиков…
              </span>
            ) : group === null ? (
              <span className="text-xs text-neutral-500">
                нет на складах — под заказ
              </span>
            ) : null}
          </div>
        </div>
        <ChevronRight className="ml-auto h-5 w-5 shrink-0 self-center text-neutral-600 transition-colors group-hover:text-orange-500" />
      </div>
      <div className="flex w-full items-center justify-center gap-2 border-t border-neutral-800 bg-neutral-800/30 py-2.5 text-xs font-medium text-neutral-400 transition-colors group-hover:bg-neutral-800/60 group-hover:text-orange-400">
        {group === null
          ? "Уточнить цену под заказ"
          : "Цены и наличие у поставщиков"}
        <ChevronRight className="h-3.5 w-3.5" />
      </div>
    </Link>
  );
}
