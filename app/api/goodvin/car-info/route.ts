import { NextRequest, NextResponse } from "next/server";
import { goodvin } from "@/lib/goodvinServer";
import { goodvinErrorResponse } from "@/lib/goodvinRoute";

/**
 * Поиск авто по VIN или FRAME.
 * GET /api/goodvin/car-info?q=<vin>&catalogs=<id,id>
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const catalogs = request.nextUrl.searchParams.get("catalogs") || undefined;

  if (!q) {
    return NextResponse.json(
      { error: "Укажите VIN или Frame в параметре q" },
      { status: 400 }
    );
  }

  try {
    const cars = await goodvin.carInfo(q, catalogs);
    return NextResponse.json({ cars: Array.isArray(cars) ? cars : [] });
  } catch (error) {
    return goodvinErrorResponse(error);
  }
}
