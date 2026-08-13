import { NextRequest, NextResponse } from "next/server";
import { laximo as goodvin } from "@/lib/laximo/catalog";
import { goodvinErrorResponse } from "@/lib/goodvinRoute";
import { CACHE_VIN_INFO } from "@/lib/http-cache";

/**
 * Поиск авто по VIN, ГОС НОМЕРУ или НОМЕРУ КУЗОВА.
 * GET /api/goodvin/car-info?q=<vin>          — по VIN
 * GET /api/goodvin/car-info?plate=<номер>    — по гос номеру
 * GET /api/goodvin/car-info?frame=<кузов>    — по номеру кузова (AGH30-0115914)
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const q = sp.get("q")?.trim();
  const plate = sp.get("plate")?.trim();
  const frame = sp.get("frame")?.trim();
  const catalogs = sp.get("catalogs") || undefined;

  if (!q && !plate && !frame) {
    return NextResponse.json(
      { error: "Укажите VIN (q), гос номер (plate) или номер кузова (frame)" },
      { status: 400 }
    );
  }

  try {
    const cars = frame
      ? await goodvin.carInfoByFrame(frame)
      : plate
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
