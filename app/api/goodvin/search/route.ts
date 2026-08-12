import { NextRequest, NextResponse } from "next/server";
import { laximo } from "@/lib/laximo/catalog";
import { goodvinErrorResponse } from "@/lib/goodvinRoute";
import { CACHE_VIN_TREE } from "@/lib/http-cache";

/**
 * Поиск детали по названию/номеру внутри каталога выбранного авто.
 * GET /api/goodvin/search?catalogId=&carId=&criteria=&q=
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const catalogId = sp.get("catalogId")?.trim();
  const carId = sp.get("carId")?.trim();
  const criteria = sp.get("criteria") || undefined;
  const q = sp.get("q")?.trim();

  if (!catalogId || !carId || !q) {
    return NextResponse.json(
      { error: "Нужны параметры catalogId, carId и q" },
      { status: 400 }
    );
  }

  try {
    const results = await laximo.searchParts(catalogId, {
      carId,
      criteria,
      query: q,
    });
    return NextResponse.json(
      { results },
      { headers: { "Cache-Control": CACHE_VIN_TREE } }
    );
  } catch (error) {
    return goodvinErrorResponse(error);
  }
}
