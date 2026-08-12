import { NextRequest, NextResponse } from "next/server";
import { laximo as goodvin } from "@/lib/laximo/catalog";
import { goodvinErrorResponse } from "@/lib/goodvinRoute";
import { CACHE_VIN_INFO } from "@/lib/http-cache";

/**
 * Поиск авто по VIN или ГОС НОМЕРУ.
 * GET /api/goodvin/car-info?q=<vin>  — по VIN
 * GET /api/goodvin/car-info?plate=<гос номер>  — по гос номеру
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const q = sp.get("q")?.trim();
  const plate = sp.get("plate")?.trim();
  const catalogs = sp.get("catalogs") || undefined;

  if (!q && !plate) {
    return NextResponse.json(
      { error: "Укажите VIN (q) или гос номер (plate)" },
      { status: 400 }
    );
  }

  try {
    const cars = plate
      ? await goodvin.carInfoByPlate(plate)
      : await goodvin.carInfo(q!, catalogs);
    return NextResponse.json(
      { cars: Array.isArray(cars) ? cars : [] },
      { headers: { "Cache-Control": CACHE_VIN_INFO } }
    );
  } catch (error) {
    return goodvinErrorResponse(error);
  }
}
