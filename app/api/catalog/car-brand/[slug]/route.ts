import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, productStocks } from "@/lib/db/schema";
import { eq, desc, asc, and, sql as dsql, inArray } from "drizzle-orm";
import type { SupplierGroup, SupplierOffer } from "@/lib/suppliers/adapter";
import { dedupeGroups, isValidPrice, MAX_PLAUSIBLE_PRICE } from "@/lib/suppliers/adapter";
import { CAR_BRAND_META } from "@/lib/catalog/classifier";
import { enrichGroupsWithImages } from "@/lib/product-images";
import { getVegaName } from "@/lib/vega-names";

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
    // Серверная пагинация: limit=20 на страницу, переключение страницы =
    // новый fetch. Раньше тащили весь каталог марки авто (несколько МБ).
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam
      ? Math.min(Math.max(parseInt(limitParam, 10), 1), 100)
      : 20;
    const pageParam = url.searchParams.get("page");
    const offsetParam = url.searchParams.get("offset");
    const offset = pageParam
      ? Math.max(parseInt(pageParam, 10) - 1, 0) * limit
      : Math.max(parseInt(offsetParam || "0", 10), 0);
    const sort = url.searchParams.get("sort") || "price-asc";
    const brandFilter = url.searchParams.get("brand")?.trim() || "";

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

    // Без фильтра source='berg' — показываем товары всех поставщиков
    // (forum-auto/rossko/shate-m/armtek/berg), как и в роуте категории.
    const baseConditions = [
      dsql`${products.stock} > 0`,
      // Прячем позиции с битой ценой (NaN/баркод-мусор от Армтек-импорта): NaN
      // в Postgres сортируется ВЫШЕ всех при price-desc и всплывал первым,
      // роняя страницу. `< MAX` отсекает и NaN (NaN < X = false), и нереальные
      // суммы; так же, как в роуте категории.
      dsql`${products.ourPrice} > 0`,
      dsql`${products.ourPrice} < ${MAX_PLAUSIBLE_PRICE}`,
      // Используем `car_brands @> ARRAY[...]`, а НЕ `'X' = ANY(car_brands)`:
      // только форма `@>` задействует GIN-индекс idx_products_car_brands.
      // `= ANY(array)` его игнорирует и даёт seq scan по всей таблице (748к
      // строк) — отсюда долгая первая загрузка страницы бренда.
      dsql`${products.carBrands} @> ARRAY[${carBrand}]::text[]`,
    ];
    if (category) baseConditions.push(eq(products.categorySlug, category));

    const conditionsWithFilter = brandFilter
      ? [...baseConditions, eq(products.brand, brandFilter)]
      : baseConditions;

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
      .where(and(...conditionsWithFilter))
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
      const offers: SupplierOffer[] = stocks
        .map((s) => ({
          supplier: getVegaName(s.supplierCode),
          supplierCode: s.supplierCode,
          price: Number(s.supplierPrice),
          ourPrice: Number(s.ourPrice),
          stock: s.quantity,
          deliveryDays: s.deliveryDays ?? null,
        }))
        // Битый офер (NaN/мусор) при валидном товаре иначе обнулил бы minPrice
        // в null через Math.min(…, NaN) = NaN. См. роут категории.
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

    const [{ count = 0 } = { count: 0 }] = await db
      .select({ count: dsql<number>`COUNT(*)::int` })
      .from(products)
      .where(and(...conditionsWithFilter));

    // Список доступных брендов запчастей в выборке (без учёта brand-фильтра).
    const brandRows = await db
      .selectDistinct({ brand: products.brand })
      .from(products)
      .where(and(...baseConditions));
    const availableBrands = brandRows
      .map((r) => r.brand)
      .filter((b): b is string => Boolean(b))
      .sort();

    // Подсеваем картинки из кэша product_images — клиент не будет делать
    // N round-trip'ов к /api/product-image на рендере грида.
    const enriched = await enrichGroupsWithImages(dedupeGroups(groups));

    return NextResponse.json({
      slug: carBrand,
      title: meta?.title ?? carBrand,
      category: category ?? null,
      groups: enriched,
      count,
      limit,
      offset,
      page: Math.floor(offset / limit) + 1,
      availableBrands,
    });
  } catch (error) {
    console.error("Catalog car-brand route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
