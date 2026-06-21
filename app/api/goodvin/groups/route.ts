import { NextRequest, NextResponse } from "next/server";
import { goodvin } from "@/lib/goodvinServer";
import { goodvinErrorResponse } from "@/lib/goodvinRoute";
import { CACHE_VIN_TREE } from "@/lib/http-cache";

/**
 * Узлы каталога. Пустой groupId — корневые группы.
 * GET /api/goodvin/groups?catalogId=&carId=&groupId=&criteria=
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const catalogId = sp.get("catalogId")?.trim();
  const carId = sp.get("carId")?.trim();
  const groupId = sp.get("groupId") || undefined;
  const criteria = sp.get("criteria") || undefined;

  if (!catalogId || !carId) {
    return NextResponse.json(
      { error: "Нужны параметры catalogId и carId" },
      { status: 400 }
    );
  }

  try {
    const groups = await goodvin.getGroups(catalogId, {
      carId,
      groupId,
      criteria,
    });
    return NextResponse.json(
      { groups: Array.isArray(groups) ? groups : [] },
      { headers: { "Cache-Control": CACHE_VIN_TREE } }
    );
  } catch (error) {
    return goodvinErrorResponse(error);
  }
}
