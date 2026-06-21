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
import { CACHE_PRODUCT } from "@/lib/http-cache";
import { findDbProductGroup } from "@/lib/suppliers/db-group";
import { withServerTiming } from "@/lib/server-timing";

interface ProductDetailResponse {
  group: SupplierGroup | null;
  characteristics: ShateCharacteristic[];
  originals: Array<{ code: string; brand: string }>;
  analogs: SupplierGroup[];
}

async function getHandler(
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

    // Параллельно: офферы по точному article+brand от всех + articleId в ShATE-M.
    // Таймаут 6000мс (был 10000): живая цена на карточке появляется быстрее.
    // Каждый адаптер по race отдаёт ЛИБО полный список, ЛИБО [] — частичных нет,
    // так что урезание не «портит» ответ, лишь отсекает не успевших. Быстрые
    // (Berg/ShATE-M/Forum) укладываются; для каталожных товаров цена и так уже
    // показана из локального сида (см. app/product/[id]/page.tsx).
    const [mainItems, shateArticleId] = await Promise.all([
      searchAllSuppliers(adapters, { article: decoded, brand }, 6000).catch(
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

    // Засеваем картинку и для ГЛАВНОГО товара (не только аналогов) — иначе клиент
    // делает второй, медленный запрос /api/product-image за самой важной картинкой
    // экрана (LCP). enrichGroupsWithImages подставит готовый URL из кэша, если он есть.
    let enrichedMain: SupplierGroup | null = mainGroup;
    if (mainGroup) {
      const [m] = await enrichGroupsWithImages([mainGroup]);
      enrichedMain = m ?? mainGroup;
    }

    const response: ProductDetailResponse = {
      group: enrichedMain,
      characteristics,
      originals,
      analogs,
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": CACHE_PRODUCT },
    });
  } catch (error) {
    console.error("Product detail route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const GET = withServerTiming(getHandler);
