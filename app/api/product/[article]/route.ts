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
  analogs: Array<{ article: string; brand: string; name: string }>;
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

    const [supplierItems, shateArticleId] = await Promise.all([
      searchAllSuppliers(adapters, { article: decoded, brand }, 10000).catch(
        () => [] as SupplierItem[]
      ),
      (shateMAdapter as ShateMAdapter).findArticleId(decoded, brand).catch(() => null),
    ]);

    const groups = groupOffers(supplierItems, (base, ctx) =>
      applyPricingSync(base, ctx)
    );

    const match =
      groups.find((g) => g.brand.toLowerCase() === brand.toLowerCase()) ||
      groups[0] ||
      null;

    let characteristics: ShateCharacteristic[] = [];
    let originals: ProductDetailResponse["originals"] = [];
    let analogs: ProductDetailResponse["analogs"] = [];

    if (shateArticleId) {
      const [details, analogList] = await Promise.all([
        (shateMAdapter as ShateMAdapter).getArticleDetails(shateArticleId),
        (shateMAdapter as ShateMAdapter).getAnalogs(shateArticleId),
      ]);

      characteristics = details?.extendedInfo?.characteristics ?? [];
      originals = (details?.extendedInfo?.originals ?? []).map((o) => ({
        code: o.code,
        brand: o.tradeMarkName ?? "",
      }));
      analogs = analogList
        .filter((a) => a.article?.code && a.article?.tradeMarkName)
        .slice(0, 12)
        .map((a) => ({
          article: a.article.code,
          brand: a.article.tradeMarkName ?? a.tradeMark?.name ?? "",
          name: a.article.name ?? "",
        }));
    }

    const response: ProductDetailResponse = {
      group: match,
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
