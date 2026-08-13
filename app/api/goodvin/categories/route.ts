import { NextRequest, NextResponse } from "next/server";
import { laximo } from "@/lib/laximo/catalog";
import { goodvinErrorResponse } from "@/lib/goodvinRoute";
import { CACHE_VIN_TREE } from "@/lib/http-cache";

/**
 * Категории каталога для режима «Все схемы» (категории → узлы-схемы).
 * GET /api/goodvin/categories?catalogId=&carId=&criteria=
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const catalogId = sp.get("catalogId")?.trim();
  const carId = sp.get("carId")?.trim() ?? "";
  const criteria = sp.get("criteria") ?? "";

  if (!catalogId) {
    return NextResponse.json({ error: "Укажите catalogId" }, { status: 400 });
  }

  try {
    const categories = await laximo.getCategories(catalogId, {
      carId,
      criteria,
    });
    return NextResponse.json(
      { categories },
      { headers: { "Cache-Control": CACHE_VIN_TREE } }
    );
  } catch (error) {
    return goodvinErrorResponse(error);
  }
}
