import { NextRequest, NextResponse } from "next/server";
import { laximo } from "@/lib/laximo/catalog";
import { goodvinErrorResponse } from "@/lib/goodvinRoute";
import { CACHE_VIN_TREE } from "@/lib/http-cache";

/**
 * ПОЛНОЕ дерево узлов каталога — для постоянного дерева слева (как у Армтека).
 * GET /api/goodvin/tree?catalogId=&carId=&criteria=
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const catalogId = sp.get("catalogId")?.trim();
  const carId = sp.get("carId")?.trim();
  const criteria = sp.get("criteria") || undefined;

  if (!catalogId || !carId) {
    return NextResponse.json(
      { error: "Нужны параметры catalogId и carId" },
      { status: 400 }
    );
  }

  try {
    const tree = await laximo.getTree(catalogId, { carId, criteria });
    return NextResponse.json(
      { tree },
      { headers: { "Cache-Control": CACHE_VIN_TREE } }
    );
  } catch (error) {
    return goodvinErrorResponse(error);
  }
}
