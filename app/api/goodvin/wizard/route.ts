import { NextRequest, NextResponse } from "next/server";
import { laximo } from "@/lib/laximo/catalog";
import { goodvinErrorResponse } from "@/lib/goodvinRoute";
import { CACHE_VIN_TREE } from "@/lib/http-cache";

/**
 * Мастер подбора авто по параметрам (модель/год/двигатель…) без VIN.
 * GET /api/goodvin/wizard?catalogId=<code>&ssd=<ssd|пусто>
 * Выбор опции шага даёт новый ssd → повторный вызов уточняет шаги.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const catalogId = sp.get("catalogId")?.trim();
  const ssd = sp.get("ssd") ?? "";

  if (!catalogId) {
    return NextResponse.json({ error: "Укажите catalogId" }, { status: 400 });
  }

  try {
    const steps = await laximo.getWizard(catalogId, ssd);
    return NextResponse.json(
      { steps },
      { headers: { "Cache-Control": CACHE_VIN_TREE } }
    );
  } catch (error) {
    return goodvinErrorResponse(error);
  }
}
