import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, productStocks } from "@/lib/db/schema";
import { and, inArray, or, sql as dsql, type SQL } from "drizzle-orm";
import type { SupplierGroup, SupplierOffer } from "@/lib/suppliers/adapter";
import { dedupeGroups } from "@/lib/suppliers/adapter";
import { enrichGroupsWithImages } from "@/lib/product-images";
import {
  FOLD_FROM,
  FOLD_TO,
  normalizeName,
  normalizeArticle,
  tokenize,
  expandToken,
} from "@/lib/catalog/normalize";

/**
 * Поиск по названию/артикулу в импортированном каталоге (Supabase).
 *
 * Многоуровневый поиск, устойчивый к опечаткам и раскладке:
 *   1) exact   — все слова запроса должны найтись (с синонимами и нормализацией);
 *   2) relaxed — если точных нет: хотя бы одно слово (показываем «похожие»);
 *   3) fuzzy   — если и тех нет: триграммное сходство pg_trgm («вы имели в виду»).
 * Tier 3 включается только если в БД установлено расширение pg_trgm
 * (см. scripts/enable-fuzzy-search.mjs); иначе шаг безопасно пропускается.
 *
 * GET /api/catalog/text-search?q=масло+фильтр&limit=200&sort=price-asc
 */

// SQL-нормализация названия — обязана совпадать с normalizeName() в TS.
const NAME_NORM = dsql`translate(lower(${products.name}), ${FOLD_FROM}, ${FOLD_TO})`;
const ART_NORM = dsql`lower(${products.article})`;

type Mode = "exact" | "relaxed" | "fuzzy";

interface Row {
  id: number;
  article: string;
  brand: string | null;
  name: string;
  ourPrice: string;
  supplierPrice: string;
  stock: number;
}

const SELECT = {
  id: products.id,
  article: products.article,
  brand: products.brand,
  name: products.name,
  ourPrice: products.ourPrice,
  supplierPrice: products.supplierPrice,
  stock: products.stock,
};

/** Условие на один токен: имя (с синонимами) ИЛИ артикул. */
function tokenCondition(token: string): SQL {
  const variants = expandToken(token);
  const nameConds = variants.map(
    (v) => dsql`${NAME_NORM} LIKE ${"%" + v + "%"}`
  );
  const artCond = dsql`${ART_NORM} LIKE ${"%" + token + "%"}`;
  return or(...nameConds, artCond)!;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Оценка релевантности строки запросу (выше — релевантнее). */
function relevance(nameNorm: string, articleLower: string, tokens: string[]): number {
  let score = 0;
  for (const t of tokens) {
    const whole = new RegExp(
      `(^|[^а-яёa-z0-9])${escapeRegex(t)}([^а-яёa-z0-9]|$)`
    ).test(nameNorm);
    if (whole) score += 4;
    else if (nameNorm.includes(t)) score += 1;
    if (nameNorm.startsWith(t)) score += 1;
    if (articleLower.includes(t)) score += 2;
  }
  return score;
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim();
    if (q.length < 2) {
      return NextResponse.json({ groups: [], count: 0, mode: "exact" as Mode });
    }

    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") || "200", 10) || 200, 1),
      1000
    );
    const sort = url.searchParams.get("sort") || "price-asc";

    const qNorm = normalizeName(q);
    const tokens = tokenize(qNorm);
    const tokenConds =
      tokens.length === 0 ? [tokenCondition(qNorm)] : tokens.map(tokenCondition);

    const stockPositive = dsql`${products.stock} > 0`;

    // Tier 1 — exact: все токены.
    let rows: Row[] = await db
      .select(SELECT)
      .from(products)
      .where(and(stockPositive, ...tokenConds))
      .limit(limit);
    let mode: Mode = "exact";

    // Tier 2 — relaxed: хотя бы один токен.
    if (rows.length === 0 && tokenConds.length > 1) {
      rows = await db
        .select(SELECT)
        .from(products)
        .where(and(stockPositive, or(...tokenConds)!))
        .limit(limit);
      if (rows.length) mode = "relaxed";
    }

    // Tier 3 — fuzzy (pg_trgm). Безопасно пропускается, если расширение не стоит.
    if (rows.length === 0) {
      try {
        const wsim = dsql`word_similarity(${qNorm}, ${NAME_NORM})`;
        rows = await db
          .select(SELECT)
          .from(products)
          .where(and(stockPositive, dsql`${wsim} > 0.4`))
          .orderBy(dsql`${wsim} DESC`)
          .limit(50);
        if (rows.length) mode = "fuzzy";
      } catch {
        // pg_trgm не установлено — фаззи-поиск недоступен, это не ошибка.
      }
    }

    // Релевантность считаем в JS (надёжнее и без зависимости от pg_trgm),
    // затем применяем выбранную пользователем сортировку как вторичную.
    const ranked = rows
      .map((p) => ({
        p,
        rel: relevance(normalizeName(p.name), p.article.toLowerCase(), tokens),
      }))
      .sort((a, b) => {
        if (b.rel !== a.rel) return b.rel - a.rel;
        switch (sort) {
          case "price-desc":
            return Number(b.p.ourPrice) - Number(a.p.ourPrice);
          case "stock":
            return b.p.stock - a.p.stock;
          case "name":
            return a.p.name.localeCompare(b.p.name, "ru");
          default:
            return Number(a.p.ourPrice) - Number(b.p.ourPrice);
        }
      })
      .map((r) => r.p);

    const ids = ranked.map((p) => p.id);
    const stockRows = ids.length
      ? await db
          .select()
          .from(productStocks)
          .where(inArray(productStocks.productId, ids))
      : [];

    const stocksByProduct = new Map<number, typeof stockRows>();
    for (const s of stockRows) {
      const list = stocksByProduct.get(s.productId) ?? [];
      list.push(s);
      stocksByProduct.set(s.productId, list);
    }

    const groups: SupplierGroup[] = ranked.map((p) => {
      const stocks = stocksByProduct.get(p.id) ?? [];
      const offers: SupplierOffer[] = stocks.map((s) => ({
        supplier: `Berg (${s.warehouseName})`,
        supplierCode: s.supplierCode,
        price: Number(s.supplierPrice),
        ourPrice: Number(s.ourPrice),
        stock: s.quantity,
        deliveryDays: s.deliveryDays ?? null,
      }));

      offers.sort((a, b) => a.ourPrice - b.ourPrice);

      const prices = offers.map((o) => o.ourPrice);
      const deliveries = offers
        .map((o) => o.deliveryDays)
        .filter((d): d is number => d != null);
      const totalStock = offers.reduce((a, o) => a + o.stock, 0);

      return {
        article: p.article,
        brand: p.brand ?? "",
        name: p.name,
        minPrice: prices.length ? Math.min(...prices) : Number(p.ourPrice),
        maxPrice: prices.length ? Math.max(...prices) : Number(p.ourPrice),
        totalStock: totalStock || p.stock,
        minDeliveryDays: deliveries.length ? Math.min(...deliveries) : null,
        offers,
      };
    });

    // dedupeGroups может переупорядочить — но картинки и порядок релевантности
    // сохраняем: dedupe не сортирует, только схлопывает дубли article+brand.
    const enriched = await enrichGroupsWithImages(dedupeGroups(groups));

    return NextResponse.json({
      q,
      groups: enriched,
      count: enriched.length,
      mode,
      limit,
    });
  } catch (error) {
    console.error("Text search error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
