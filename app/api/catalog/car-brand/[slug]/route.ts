import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, productStocks } from "@/lib/db/schema";
import { eq, desc, asc, and, sql as dsql, inArray } from "drizzle-orm";
import type { SupplierGroup, SupplierOffer } from "@/lib/suppliers/adapter";
import { CAR_BRAND_META } from "@/lib/catalog/classifier";

/**
 * Товары, совместимые с указанной маркой авто.
 * Фильтр: products.car_brands содержит slug (например, 'BMW').
 * Дополнительно поддерживается category_slug — можно комбинировать:
 *   /api/catalog/car-brand/BMW?category=brake-pads
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const carBrand = slug.toUpperCase();
    const meta = CAR_BRAND_META.find((m) => m.slug === carBrand);

    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "500", 10), 2000);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10), 0);
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

    const conditions = [
      eq(products.source, "berg"),
      dsql`${products.stock} > 0`,
      dsql`${carBrand} = ANY(${products.carBrands})`,
    ];
    if (category) conditions.push(eq(products.categorySlug, category));

    const productRows = await db
      .select({
        id: products.id,
        article: products.article,
        brand: products.brand,
        name: products.name,
        ourPrice: products.ourPrice,
        supplierPrice: products.supplierPrice,
        stock: products.stock,
        categorySlug: products.categorySlug,
      })
      .from(products)
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

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

    const [{ count = 0 } = { count: 0 }] = await db
      .select({ count: dsql<number>`COUNT(*)::int` })
      .from(products)
      .where(and(...conditions));

    return NextResponse.json({
      slug: carBrand,
      title: meta?.title ?? carBrand,
      category: category ?? null,
      groups,
      count,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Catalog car-brand route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
