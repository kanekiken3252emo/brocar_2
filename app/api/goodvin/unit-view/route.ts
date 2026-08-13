import { NextRequest, NextResponse } from "next/server";
import { laximo } from "@/lib/laximo/catalog";
import { goodvinErrorResponse } from "@/lib/goodvinRoute";
import { CACHE_VIN_TREE } from "@/lib/http-cache";

/**
 * Узел целиком для режима «Все схемы»: детали + карта выносок.
 * GET /api/goodvin/unit-view?catalogId=&carId=&unitId=&ssd=
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const catalogId = sp.get("catalogId")?.trim();
  const carId = sp.get("carId")?.trim() ?? "";
  const unitId = sp.get("unitId")?.trim();
  const ssd = sp.get("ssd") ?? "";

  if (!catalogId || !unitId || !ssd) {
    return NextResponse.json(
      { error: "Укажите catalogId, unitId и ssd" },
      { status: 400 }
    );
  }

  try {
    const view = await laximo.getUnitView(catalogId, { carId, unitId, ssd });
    return NextResponse.json(view, {
      headers: { "Cache-Control": CACHE_VIN_TREE },
    });
  } catch (error) {
    return goodvinErrorResponse(error);
  }
}
