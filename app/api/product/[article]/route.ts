import { NextRequest, NextResponse } from "next/server";
import {
  searchAllSuppliers,
  groupOffers,
  compareGroupsByDelivery,
  type SupplierGroup,
  type SupplierItem,
} from "@/lib/suppliers/adapter";
import bergAdapter from "@/lib/suppliers/berg";
import rosskoAdapter from "@/lib/suppliers/rossko";
import shateMAdapter, {
  ShateMAdapter,
  type ShateCharacteristic,
} from "@/lib/suppliers/shate-m";
import forumAutoAdapter from "@/lib/suppliers/forum-auto";
import armtekAdapter from "@/lib/suppliers/armtek";
import autotradeAdapter from "@/lib/suppliers/autotrade";
import partKomAdapter from "@/lib/suppliers/partkom";
import { applyPricingSync } from "@/lib/pricing";
import { enrichGroupsWithImages } from "@/lib/product-images";
import { db } from "@/lib/db";
import { products, productStocks } from "@/lib/db/schema";
import { and, eq, ilike, inArray } from "drizzle-orm";
import { getVegaName } from "@/lib/vega-names";

/**
 * Фолбэк на каталог из БД: если ни один поставщик не вернул артикул
 * вживую (например, ручной/тестовый товар source='manual'), собираем
 * группу из таблиц products + product_stocks — так же, как в text-search.
 */
async function findDbProductGroup(
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

interface ProductDetailResponse {
  group: SupplierGroup | null;
  characteristics: ShateCharacteristic[];
  originals: Array<{ code: string; brand: string }>;
  analogs: SupplierGroup[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ article: string }> }
) {
  try {
    const { article } = await params;
    const decoded = decodeURIComponent(article);
    const brand = request.nextUrl.searchParams.get("brand") || "";

    const adapters = [
      bergAdapter,
      rosskoAdapter,
      shateMAdapter,
      forumAutoAdapter,
      armtekAdapter,
      autotradeAdapter,
      partKomAdapter,
    ];

    // Параллельно: офферы по точному article+brand от всех + articleId в ShATE-M
    const [mainItems, shateArticleId] = await Promise.all([
      searchAllSuppliers(adapters, { article: decoded, brand }, 10000).catch(
        () => [] as SupplierItem[]
      ),
      (shateMAdapter as ShateMAdapter).findArticleId(decoded, brand).catch(() => null),
    ]);

    const pricing = (base: number, ctx: { brand?: string }) =>
      applyPricingSync(base, ctx);

    const mainGroups = groupOffers(mainItems, pricing);
    let mainGroup: SupplierGroup | null =
      mainGroups.find((g) => g.brand.toLowerCase() === brand.toLowerCase()) ||
      mainGroups[0] ||
      null;

    // Поставщики ничего не дали — пробуем каталог из БД (ручные/тестовые товары).
    if (!mainGroup) {
      mainGroup = await findDbProductGroup(decoded, brand).catch(() => null);
    }

    let characteristics: ShateCharacteristic[] = [];
    let originals: ProductDetailResponse["originals"] = [];
    let analogs: SupplierGroup[] = [];

    if (shateArticleId) {
      // Характеристики + офферы по аналогам одним большим запросом (с includeAnalogs)
      const [details, analogItems] = await Promise.all([
        (shateMAdapter as ShateMAdapter).getArticleDetails(shateArticleId),
        (shateMAdapter as ShateMAdapter).searchWithAnalogsById(shateArticleId),
      ]);

      characteristics = details?.extendedInfo?.characteristics ?? [];
      originals = (details?.extendedInfo?.originals ?? []).map((o) => ({
        code: o.code,
        brand: o.tradeMarkName ?? "",
      }));

      // Группируем все полученные item'ы (основной + аналоги)
      const analogGroups = groupOffers(analogItems, pricing);

      // Исключаем группу самого искомого товара — она уже в mainGroup.
      // Сортируем «в наличии → быстрее → дешевле» (срок в приоритете), чтобы
      // самые быстрые позиции (сегодня/завтра) были вверху, и берём топ-20
      // именно по скорости, а не по цене.
      const mainKey = `${decoded.toLowerCase()}|${brand.toLowerCase()}`;
      analogs = analogGroups
        .filter(
          (g) =>
            `${g.article.toLowerCase()}|${g.brand.toLowerCase()}` !== mainKey
        )
        .sort(compareGroupsByDelivery)
        .slice(0, 20);

      // Подмешиваем готовые URL картинок из кэша product_images, чтобы клиент
      // засеял in-memory cache и не делал N запросов к /api/product-image на
      // карточках аналогов (см. enrichGroupsWithImages / seedProductImageCache).
      analogs = await enrichGroupsWithImages(analogs);
    }

    const response: ProductDetailResponse = {
      group: mainGroup,
      characteristics,
      originals,
      analogs,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Product detail route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
