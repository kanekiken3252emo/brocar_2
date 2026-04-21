import { NextRequest, NextResponse } from "next/server";
import {
  searchAllSuppliers,
  groupOffers,
  type SupplierGroup,
  type SupplierItem,
} from "@/lib/suppliers/adapter";
import bergAdapter from "@/lib/suppliers/berg";
import rosskoAdapter from "@/lib/suppliers/rossko";
import shateMAdapter, {
  ShateMAdapter,
  type ShateCharacteristic,
} from "@/lib/suppliers/shate-m";
import { applyPricingSync } from "@/lib/pricing";

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

    const adapters = [bergAdapter, rosskoAdapter, shateMAdapter];

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
    const mainGroup =
      mainGroups.find((g) => g.brand.toLowerCase() === brand.toLowerCase()) ||
      mainGroups[0] ||
      null;

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

      // Исключаем группу самого искомого товара — она уже в mainGroup
      const mainKey = `${decoded.toLowerCase()}|${brand.toLowerCase()}`;
      analogs = analogGroups
        .filter(
          (g) =>
            `${g.article.toLowerCase()}|${g.brand.toLowerCase()}` !== mainKey
        )
        .slice(0, 20);
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
