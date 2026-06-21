import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, productStocks } from "@/lib/db/schema";
import { and, inArray, or, sql as dsql, type SQL } from "drizzle-orm";
import type { SupplierGroup, SupplierOffer } from "@/lib/suppliers/adapter";
import { dedupeGroups, isValidPrice, normalizeArticle as normArticleKey } from "@/lib/suppliers/adapter";
import { lookupCachedBatch } from "@/lib/product-images";
import { CACHE_LISTING } from "@/lib/http-cache";
import {
  FOLD_FROM,
  FOLD_TO,
  normalizeName,
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

// SQL-нормализация названия — обязана совпадать с normalizeName() в TS И с
// выражением функционального индекса в scripts/enable-fuzzy-search.mjs.
// FOLD_FROM/FOLD_TO вставляем КАК ЛИТЕРАЛЫ (dsql.raw), а не как bound-параметры:
// иначе translate(lower(name), $1, $2) не совпадёт с translate(lower(name),
// 'ё…','е…') в индексе, и GIN-индекс не будет использоваться (seq scan).
const NAME_NORM = dsql`translate(lower(${products.name}), ${dsql.raw(
  `'${FOLD_FROM}'`
)}, ${dsql.raw(`'${FOLD_TO}'`)})`;
const ART_NORM = dsql`lower(${products.article})`;

// Экранируем спецсимволы LIKE (% _ \) в пользовательском вводе, чтобы они не
// работали как шаблоны. Сами обрамляющие % добавляем снаружи (это и есть «contains»).
function likeContains(expr: SQL, value: string): SQL {
  const esc = value.replace(/[\\%_]/g, "\\$&");
  return dsql`${expr} LIKE ${"%" + esc + "%"} ESCAPE '\\'`;
}

// Подпись поставщика по supplier_code из product_stocks (локальная БД хранит
// предложения нескольких поставщиков, не только Berg).
const SUPPLIER_LABELS: Record<string, string> = {
  berg: "Berg",
  "shate-m": "ШАТЕ-М",
  "forum-auto": "Форум-Авто",
  armtek: "Армтек",
  rossko: "Россико",
};

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

/**
 * Условие на один токен: имя (с синонимами) ИЛИ артикул.
 * Синонимы применяем только к НАЗВАНИЮ — артикул это SKU, человеческие
 * синонимы к нему не подходят, ищем по нему как есть.
 */
function tokenCondition(token: string): SQL {
  const variants = expandToken(token);
  const nameConds = variants.map((v) => likeContains(NAME_NORM, v));
  const artCond = likeContains(ART_NORM, token);
  return or(...nameConds, artCond)!;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Оценка релевантности строки запросу (выше — релевантнее). */
function relevance(nameNorm: string, articleLower: string, tokens: string[]): number {
  let score = 0;
  for (const t of tokens) {
    // nameNorm уже свёрнут (ё→е), поэтому ё в классе границ не нужен.
    const whole = new RegExp(
      `(^|[^а-яa-z0-9])${escapeRegex(t)}([^а-яa-z0-9]|$)`
    ).test(nameNorm);
    if (whole) score += 4;
    else if (nameNorm.includes(t)) score += 1;
    if (nameNorm.startsWith(t)) score += 1;
    if (articleLower.includes(t)) score += 2;
  }
  return score;
}

// Сколько максимум результатов отдаём с ПОЛНОЙ догрузкой (остатки/картинки).
// Кандидатов из БД берём больше (limit, по умолч. 200) и ранжируем ВСЕ, затем
// отдаём топ-RESULT_LIMIT — тяжёлая работа меньше без потери качества ранжирования.
// Пользователь листает 20/стр → 100 = 5 страниц самых релевантных.
const RESULT_LIMIT = 100;

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim();
    if (q.length < 2) {
      return NextResponse.json(
        { groups: [], count: 0, mode: "exact" as Mode },
        { headers: { "Cache-Control": CACHE_LISTING } }
      );
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

    // Для fuzzy сохраняем порядок из БД (по триграммному сходству word_similarity):
    // опечатка не совпадает как подстрока, поэтому JS-релевантность тут = 0 у всех
    // и перетёрла бы правильный порядок ценой. Для exact/relaxed ранжируем в JS
    // (целое слово > подстрока, имя > артикул), вторично — выбранная сортировка.
    const ranked =
      mode === "fuzzy"
        ? rows
        : rows
            .map((p) => ({
              p,
              rel: relevance(
                normalizeName(p.name),
                p.article.toLowerCase(),
                tokens
              ),
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

    // Срезаем до топ-N по релевантности ПОСЛЕ ранжирования всего набора — порядок
    // и качество выдачи сохранены, дальше тяжёлую работу (остатки/картинки/группы)
    // делаем только для этих N. count в ответе = число отданных групп (честно).
    const topRanked = ranked.slice(0, RESULT_LIMIT);

    const ids = topRanked.map((p) => p.id);
    // Остатки и кэш картинок независимы — тянем одним Promise.all (минус ~93мс хоп
    // до БД в Ирландии на каждом запросе). Ключ картинок — нормализованный article
    // (normArticleKey, как в дедупе), иначе промах на артикулах с пробелами/дефисами.
    // Промах кэша картинок не должен ронять весь ответ — .catch на пустую Map.
    const [stockRows, imageCache] = await Promise.all([
      ids.length
        ? db
            .select()
            .from(productStocks)
            .where(inArray(productStocks.productId, ids))
        : Promise.resolve([] as Array<typeof productStocks.$inferSelect>),
      lookupCachedBatch(
        topRanked.map((p) => ({ brand: p.brand ?? "", article: normArticleKey(p.article) }))
      ).catch(() => new Map<string, string | null>()),
    ]);

    const stocksByProduct = new Map<number, typeof stockRows>();
    for (const s of stockRows) {
      const list = stocksByProduct.get(s.productId) ?? [];
      list.push(s);
      stocksByProduct.set(s.productId, list);
    }

    const groups: SupplierGroup[] = topRanked.map((p) => {
      const stocks = stocksByProduct.get(p.id) ?? [];
      const offers: SupplierOffer[] = stocks
        .map((s) => ({
          supplier: `${SUPPLIER_LABELS[s.supplierCode] ?? "Поставщик"} (${s.warehouseName})`,
          supplierCode: s.supplierCode,
          price: Number(s.supplierPrice),
          ourPrice: Number(s.ourPrice),
          stock: s.quantity,
          deliveryDays: s.deliveryDays ?? null,
        }))
        // Защита от битых цен (NaN/мусор из импорта) — иначе minPrice=NaN роняет
        // рендер карточки на клиенте (в category-роуте такой фильтр уже есть).
        .filter((o) => isValidPrice(o.ourPrice));

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

    // dedupeGroups схлопывает дубли article+brand, НО сортирует результат по цене —
    // это перетёрло бы наш порядок (релевантность / триграммное сходство). Поэтому
    // после дедупликации восстанавливаем порядок из `ranked`.
    const rank = new Map<string, number>();
    topRanked.forEach((p, i) => {
      rank.set(`${normArticleKey(p.article)}|${(p.brand ?? "").trim().toLowerCase()}`, i);
    });
    const deduped = dedupeGroups(groups).sort((a, b) => {
      const ra = rank.get(`${a.article}|${a.brand.trim().toLowerCase()}`) ?? Infinity;
      const rb = rank.get(`${b.article}|${b.brand.trim().toLowerCase()}`) ?? Infinity;
      return ra - rb;
    });
    // Картинки берём из уже полученного кэша (тот же ключ, что в category-роуте:
    // нормализованные brand|article). enrichGroupsWithImages здесь больше не нужен —
    // его запрос уже сделан параллельно остаткам выше.
    const imgNorm = (s: string) => s.trim().toLowerCase();
    const enriched = deduped.map((g) => {
      const url = imageCache.get(`${imgNorm(g.brand)}|${imgNorm(g.article)}`);
      return typeof url === "string" && url.length > 0 ? { ...g, imageUrl: url } : g;
    });

    return NextResponse.json({
      q,
      groups: enriched,
      count: enriched.length,
      mode,
      limit,
    }, { headers: { "Cache-Control": CACHE_LISTING } });
  } catch (error) {
    console.error("Text search error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
