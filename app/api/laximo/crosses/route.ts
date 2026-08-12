import { NextRequest, NextResponse } from "next/server";
import { findCrosses } from "@/lib/laximo/catalog";
import { CACHE_PRODUCT } from "@/lib/http-cache";

export const runtime = "nodejs";

/**
 * Аналоги/кроссы по OEM-номеру из базы Laximo.DOC.
 * GET /api/laximo/crosses?oem=<номер>&brand=<бренд>
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const oem = sp.get("oem")?.trim();
  const brand = sp.get("brand")?.trim() || undefined;

  if (!oem) {
    return NextResponse.json({ error: "Нужен параметр oem" }, { status: 400 });
  }

  try {
    const crosses = await findCrosses(oem, brand);
    return NextResponse.json(
      { crosses },
      { headers: { "Cache-Control": CACHE_PRODUCT } }
    );
  } catch (error) {
    console.error("Laximo crosses error:", error);
    return NextResponse.json(
      { error: "Не удалось получить аналоги" },
      { status: 502 }
    );
  }
}
