import { NextRequest, NextResponse } from "next/server";
import { laximo } from "@/lib/laximo/catalog";
import { goodvinErrorResponse } from "@/lib/goodvinRoute";
import { CACHE_VIN_TREE } from "@/lib/http-cache";

/**
 * ВСЕ детали одного узла (быстрая группа показывает лишь часть — например,
 * группа «Фильтр масляный» содержит один фильтр из 14 позиций схемы).
 * GET /api/goodvin/unit-parts?catalogId=&carId=&unitId=&ssd=
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const catalogId = sp.get("catalogId")?.trim();
  const carId = sp.get("carId")?.trim();
  const unitId = sp.get("unitId")?.trim();
  const ssd = sp.get("ssd") ?? "";

  if (!catalogId || !carId || !unitId || !ssd) {
    return NextResponse.json(
      { error: "Укажите catalogId, carId, unitId и ssd" },
      { status: 400 }
    );
  }

  try {
    const parts = await laximo.getUnitParts(catalogId, { carId, unitId, ssd });
    return NextResponse.json(
      { parts },
      { headers: { "Cache-Control": CACHE_VIN_TREE } }
    );
  } catch (error) {
    return goodvinErrorResponse(error);
  }
}
