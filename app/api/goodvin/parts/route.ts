import { NextRequest, NextResponse } from "next/server";
import { goodvin } from "@/lib/goodvinServer";
import { goodvinErrorResponse } from "@/lib/goodvinRoute";
import { CACHE_VIN_TREE } from "@/lib/http-cache";

/**
 * Детали узла (для групп с hasParts: true).
 * GET /api/goodvin/parts?catalogId=&carId=&groupId=&criteria=
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const catalogId = sp.get("catalogId")?.trim();
  const carId = sp.get("carId")?.trim();
  const groupId = sp.get("groupId")?.trim();
  const criteria = sp.get("criteria") || undefined;

  if (!catalogId || !carId || !groupId) {
    return NextResponse.json(
      { error: "Нужны параметры catalogId, carId и groupId" },
      { status: 400 }
    );
  }

  try {
    const parts = await goodvin.getParts(catalogId, {
      carId,
      groupId,
      criteria,
    });
    return NextResponse.json(
      { parts },
      { headers: { "Cache-Control": CACHE_VIN_TREE } }
    );
  } catch (error) {
    return goodvinErrorResponse(error);
  }
}
