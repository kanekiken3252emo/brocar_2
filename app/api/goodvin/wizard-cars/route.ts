import { NextRequest, NextResponse } from "next/server";
import { laximo } from "@/lib/laximo/catalog";
import { goodvinErrorResponse } from "@/lib/goodvinRoute";
import { CACHE_VIN_INFO } from "@/lib/http-cache";

/**
 * Автомобили, подходящие под параметры, выбранные в мастере (без VIN).
 * GET /api/goodvin/wizard-cars?catalogId=<code>&ssd=<ssd>
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const catalogId = sp.get("catalogId")?.trim();
  const ssd = sp.get("ssd") ?? "";

  if (!catalogId || !ssd) {
    return NextResponse.json(
      { error: "Укажите catalogId и ssd" },
      { status: 400 }
    );
  }

  try {
    const cars = await laximo.findByWizard(catalogId, ssd);
    return NextResponse.json(
      { cars: Array.isArray(cars) ? cars : [] },
      { headers: { "Cache-Control": CACHE_VIN_INFO } }
    );
  } catch (error) {
    return goodvinErrorResponse(error);
  }
}
