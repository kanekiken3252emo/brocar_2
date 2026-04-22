import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, productStocks } from "@/lib/db/schema";
import { eq, desc, asc, and, sql as dsql, inArray } from "drizzle-orm";
import type { SupplierGroup, SupplierOffer } from "@/lib/suppliers/adapter";
import { getCategoryMeta } from "@/lib/catalog/classifier";

/**
 * Читает категорию напрямую из импортированного каталога Supabase.
 * Было: параллельно опрашивали Berg/Rossko/ShATE-M API (~10 сек).
 * Стало: одна SQL-выборка (~100 мс).
 *
 * Актуальные цены на момент покупки всё равно идут через API (см.
 * /api/product/[article]) — там запрашиваем свежие офферы.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const meta = getCategoryMeta(slug);

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "60", 10), 200);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10), 0);
    const sort = url.searchParams.get("sort") || "price-asc";

    // 1. Товары категории (только те что в наличии)
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
      .where(
        and(
          eq(products.categorySlug, slug),
          eq(products.source, "berg"),
          dsql`${products.stock} > 0`
        )
      )
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    // 2. Остатки по складам — одним запросом на весь набор id
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

    // 3. Сборка SupplierGroup[] в формате ожидаемом фронтендом
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

    // 4. Общее количество для пагинации
    const [{ count = 0 } = { count: 0 }] = await db
      .select({ count: dsql<number>`COUNT(*)::int` })
      .from(products)
      .where(
        and(
          eq(products.categorySlug, slug),
          eq(products.source, "berg"),
          dsql`${products.stock} > 0`
        )
      );

    return NextResponse.json({
      slug,
      title: meta?.title ?? slug,
      description: meta?.description ?? null,
      groups,
      count,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Catalog category route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
