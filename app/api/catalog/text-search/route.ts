import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, productStocks } from "@/lib/db/schema";
import { and, asc, desc, inArray, or, ilike, sql as dsql } from "drizzle-orm";
import type { SupplierGroup, SupplierOffer } from "@/lib/suppliers/adapter";

/**
 * Поиск по названию/артикулу в импортированном каталоге Supabase.
 *
 * Используется когда юзер пишет в строку поиска свободный текст
 * («Лампа накаливания», «масляный фильтр»), а не точный артикул —
 * на такой запрос API поставщиков не отвечает, нужна выборка из БД.
 *
 * GET /api/catalog/text-search?q=лампа&limit=200&sort=price-asc
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim();
    if (q.length < 2) {
      return NextResponse.json({ groups: [], count: 0 });
    }

    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") || "200", 10) || 200, 1),
      1000
    );
    const sort = url.searchParams.get("sort") || "price-asc";

    const orderBy = (() => {
      switch (sort) {
        case "price-desc":
          return desc(products.ourPrice);
        case "stock":
          return desc(products.stock);
        case "name":
          return asc(products.name);
        default:
          return asc(products.ourPrice);
      }
    })();

    // Ищем по нескольким словам: каждое слово должно встретиться в имени
    // или артикуле. Это устойчиво к опечаткам в окончаниях слов и порядку.
    const tokens = q
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2)
      .slice(0, 5);

    const tokenConds =
      tokens.length === 0
        ? [or(ilike(products.name, `%${q}%`), ilike(products.article, `%${q}%`))]
        : tokens.map((t) =>
            or(ilike(products.name, `%${t}%`), ilike(products.article, `%${t}%`))
          );

    const productRows = await db
      .select({
        id: products.id,
        article: products.article,
        brand: products.brand,
        name: products.name,
        ourPrice: products.ourPrice,
        supplierPrice: products.supplierPrice,
        stock: products.stock,
      })
      .from(products)
      .where(and(dsql`${products.stock} > 0`, ...tokenConds))
      .orderBy(orderBy)
      .limit(limit);

    const ids = productRows.map((p) => p.id);
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

    const groups: SupplierGroup[] = productRows.map((p) => {
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

    return NextResponse.json({
      q,
      groups,
      count: groups.length,
      limit,
    });
  } catch (error) {
    console.error("Text search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
