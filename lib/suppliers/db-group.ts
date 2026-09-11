import "server-only";
import { and, gt, gte, ilike, inArray, lt, sql as dsql } from "drizzle-orm";
import { db } from "@/lib/db";
import { products, productStocks } from "@/lib/db/schema";
import { getVegaName } from "@/lib/vega-names";
import {
  isValidPrice,
  normalizeArticle,
  type SupplierGroup,
} from "@/lib/suppliers/adapter";
import { brandKey, canonicalBrand } from "@/lib/brands/canonical.mjs";
import { sameBrandFamily } from "@/lib/brands/families.mjs";
import { pickBetterName } from "@/lib/suppliers/mojibake";

type FindDbProductGroupOptions = {
  /** Объединить свежие строки одного товара для приоритетной SEO-карточки. */
  aggregateFreshOffers?: boolean;
};

/**
 * Группа товара из ЛОКАЛЬНОГО каталога (products + product_stocks) — те же данные,
 * что мгновенно рисуют страницы категорий. Используется в двух местах:
 *   • app/api/product/[article]/route.ts — фолбэк, если живой опрос поставщиков
 *     ничего не вернул (ручные/тестовые товары source='manual');
 *   • app/product/[id]/page.tsx — СИД цены/наличия в серверный шелл карточки,
 *     чтобы цена и наличие были в первом HTML, а живой опрос лишь обновлял их.
 *
 * ВАЖНО: ourPrice берётся ИЗ БД напрямую (Number(s.ourPrice)) — наценка уже зашита
 * импортёром (applyMarkup при импорте). Повторно applyPricingSync применять НЕЛЬЗЯ —
 * получим наценку поверх наценки.
 */
export async function findDbProductGroup(
  article: string,
  brand: string,
  options: FindDbProductGroupOptions = {}
): Promise<SupplierGroup | null> {
  // Поиск по НОРМАЛИЗОВАННОМУ артикулу (как в ссылке карточки: normalizeArticle).
  // Раньше тут был ilike(article) — он НЕ берёт индекс и делал seq scan по всем
  // ~768k товаров (~9 сек на КАЖДЫЙ заход в карточку!). Выражение совпадает с
  // функциональным индексом idx_products_norm_article → теперь Index Scan ~5мс.
  const norm = normalizeArticle(article);
  const articleCondition = dsql`upper(regexp_replace(${products.article}, '[^0-9A-Za-zА-Яа-я]', '', 'g')) = ${norm}`;
  const rows = options.aggregateFreshOffers
    ? await db.select().from(products).where(articleCondition)
    : await db
        .select()
        .from(products)
        .where(
          brand
            ? and(articleCondition, ilike(products.brand, brand))
            : articleCondition
        )
        .limit(1);

  // Живой API объединяет одинаковый артикул внутри концерна (VAG, PSA и т. п.).
  // Для SEO-шелла делаем то же самое на свежем локальном каталоге, чтобы H1,
  // артикул и минимальная цена совпадали с карточкой, а не зависели от случайной
  // первой строки products.
  const matchingRows = options.aggregateFreshOffers
    ? rows.filter((row) =>
        brand
          ? sameBrandFamily(row.brand, brand)
          : brandKey(canonicalBrand(row.brand)) ===
            brandKey(canonicalBrand(rows[0]?.brand))
      )
    : rows;

  const p = matchingRows[0];
  if (!p) return null;

  const productIds = matchingRows.map((row) => row.id);
  const freshSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const stocks = options.aggregateFreshOffers
    ? await db
        .select()
        .from(productStocks)
        .where(
          and(
            inArray(productStocks.productId, productIds),
            gt(productStocks.quantity, 0),
            gt(productStocks.ourPrice, "0"),
            lt(productStocks.ourPrice, "50000000"),
            gte(productStocks.updatedAt, freshSince)
          )
        )
    : await db
        .select()
        .from(productStocks)
        .where(inArray(productStocks.productId, productIds));

  const offers = stocks
    .map((s) => ({
      supplier: getVegaName(s.supplierCode) || s.warehouseName,
      supplierCode: s.supplierCode,
      price: Number(s.supplierPrice),
      ourPrice: Number(s.ourPrice),
      stock: s.quantity,
      deliveryDays: s.deliveryDays ?? null,
    }))
    .filter(
      (offer) =>
        !options.aggregateFreshOffers ||
        (offer.stock > 0 && isValidPrice(offer.ourPrice))
    );

  // Нет строк остатков — синтетический оффер из самой карточки товара.
  if (
    offers.length === 0 &&
    (!options.aggregateFreshOffers ||
      (p.source === "manual" &&
        p.stock > 0 &&
        isValidPrice(Number(p.ourPrice))))
  ) {
    offers.push({
      supplier: p.brand || "BROCAR",
      supplierCode: p.source || "manual",
      price: Number(p.supplierPrice),
      ourPrice: Number(p.ourPrice),
      stock: p.stock,
      deliveryDays: null,
    });
  }

  if (offers.length === 0) return null;

  offers.sort((a, b) => a.ourPrice - b.ourPrice);
  const prices = offers.map((o) => o.ourPrice);
  const deliveries = offers
    .map((o) => o.deliveryDays)
    .filter((d): d is number => d != null);
  const bestName = options.aggregateFreshOffers
    ? matchingRows.reduce(
        (best, row) => pickBetterName(best, row.name || ""),
        ""
      )
    : p.name;

  return {
    article: options.aggregateFreshOffers ? norm : p.article,
    brand: options.aggregateFreshOffers
      ? canonicalBrand(brand || p.brand)
      : p.brand ?? "",
    name: bestName || p.name,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    totalStock: offers.reduce((a, o) => a + o.stock, 0) || p.stock,
    minDeliveryDays: deliveries.length ? Math.min(...deliveries) : null,
    offers,
  };
}
