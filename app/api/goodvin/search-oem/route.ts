import { NextRequest, NextResponse } from "next/server";
import { laximo } from "@/lib/laximo/catalog";
import { goodvinErrorResponse } from "@/lib/goodvinRoute";
import { CACHE_VIN_TREE } from "@/lib/http-cache";

/**
 * Расположение детали в автомобиле по OEM-номеру: узлы со схемами и
 * выносками, где встречается номер (как «фото + артикул» у Армтек).
 * GET /api/goodvin/search-oem?catalogId=&carId=&criteria=&oem=
 * parts=null — каталог не поддерживает операцию или номер не найден.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const catalogId = sp.get("catalogId")?.trim();
  const carId = sp.get("carId")?.trim();
  const criteria = sp.get("criteria") || undefined;
  const oem = sp.get("oem")?.trim();

  if (!catalogId || !carId || !oem) {
    return NextResponse.json(
      { error: "Нужны параметры catalogId, carId и oem" },
      { status: 400 }
    );
  }

  try {
    const parts = await laximo.searchOemLocation(catalogId, {
      carId,
      criteria,
      oem,
    });
    return NextResponse.json(
      { parts },
      { headers: { "Cache-Control": CACHE_VIN_TREE } }
    );
  } catch (error) {
    return goodvinErrorResponse(error);
  }
}
