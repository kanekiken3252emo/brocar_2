import { NextRequest, NextResponse } from "next/server";
import { laximo } from "@/lib/laximo/catalog";
import { goodvinErrorResponse } from "@/lib/goodvinRoute";
import { CACHE_VIN_TREE } from "@/lib/http-cache";

/**
 * Узлы категории со схемами-превью (режим «Все схемы»).
 * GET /api/goodvin/units?catalogId=&carId=&categoryId=&criteria=
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const catalogId = sp.get("catalogId")?.trim();
  const carId = sp.get("carId")?.trim() ?? "";
  const categoryId = sp.get("categoryId")?.trim();
  const criteria = sp.get("criteria") ?? "";

  if (!catalogId || !categoryId) {
    return NextResponse.json(
      { error: "Укажите catalogId и categoryId" },
      { status: 400 }
    );
  }

  try {
    const units = await laximo.getUnits(catalogId, {
      carId,
      categoryId,
      criteria,
    });
    return NextResponse.json(
      { units },
      { headers: { "Cache-Control": CACHE_VIN_TREE } }
    );
  } catch (error) {
    return goodvinErrorResponse(error);
  }
}
