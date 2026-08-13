import { NextResponse } from "next/server";
import { laximo } from "@/lib/laximo/catalog";
import { goodvinErrorResponse } from "@/lib/goodvinRoute";
import { CACHE_VIN_TREE } from "@/lib/http-cache";

/**
 * Список марок-каталогов Laximo для входа в каталог без VIN.
 * GET /api/goodvin/brands
 */
export async function GET() {
  try {
    const brands = await laximo.listBrands();
    return NextResponse.json(
      { brands },
      { headers: { "Cache-Control": CACHE_VIN_TREE } }
    );
  } catch (error) {
    return goodvinErrorResponse(error);
  }
}
