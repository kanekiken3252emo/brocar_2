import "server-only";
import { and, ilike, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { products, productStocks } from "@/lib/db/schema";
import { getVegaName } from "@/lib/vega-names";
import type { SupplierGroup } from "@/lib/suppliers/adapter";

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
  brand: string
): Promise<SupplierGroup | null> {
  const conds = [ilike(products.article, article)];
  if (brand) conds.push(ilike(products.brand, brand));

  const rows = await db
    .select()
    .from(products)
    .where(and(...conds))
    .limit(1);

  const p = rows[0];
  if (!p) return null;

  const stocks = await db
    .select()
    .from(productStocks)
    .where(inArray(productStocks.productId, [p.id]));

  const offers = stocks.map((s) => ({
    supplier: getVegaName(s.supplierCode) || s.warehouseName,
    supplierCode: s.supplierCode,
    price: Number(s.supplierPrice),
    ourPrice: Number(s.ourPrice),
    stock: s.quantity,
    deliveryDays: s.deliveryDays ?? null,
  }));

  // Нет строк остатков — синтетический оффер из самой карточки товара.
  if (offers.length === 0) {
    offers.push({
      supplier: p.brand || "BROCAR",
      supplierCode: p.source || "manual",
      price: Number(p.supplierPrice),
      ourPrice: Number(p.ourPrice),
      stock: p.stock,
      deliveryDays: null,
    });
  }

  offers.sort((a, b) => a.ourPrice - b.ourPrice);
  const prices = offers.map((o) => o.ourPrice);
  const deliveries = offers
    .map((o) => o.deliveryDays)
    .filter((d): d is number => d != null);

  return {
    article: p.article,
    brand: p.brand ?? "",
    name: p.name,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    totalStock: offers.reduce((a, o) => a + o.stock, 0) || p.stock,
    minDeliveryDays: deliveries.length ? Math.min(...deliveries) : null,
    offers,
  };
}
