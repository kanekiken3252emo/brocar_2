import { NextRequest, NextResponse } from "next/server";
import { getCrossPrice } from "@/lib/cross-prices";
import { CACHE_PRODUCT } from "@/lib/http-cache";

/**
 * Предложения аналога у поставщиков — полная группа (склады/цены/сроки) для
 * рендера тем же SupplierGroupListItem, что «Аналоги в наличии».
 * GET /api/cross-price?article=<номер>&brand=<бренд> → { group | null }
 * Кэш: 6ч в БД (см. lib/cross-prices) + короткий HTTP-кэш.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const article = sp.get("article")?.trim();
  const brand = sp.get("brand")?.trim() || undefined;

  if (!article) {
    return NextResponse.json({ error: "Укажите article" }, { status: 400 });
  }

  try {
    const price = await getCrossPrice(article, brand);
    return NextResponse.json(price, {
      headers: { "Cache-Control": CACHE_PRODUCT },
    });
  } catch {
    // Ошибка опроса поставщиков — не 500, просто «предложений нет».
    return NextResponse.json(
      { group: null },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
