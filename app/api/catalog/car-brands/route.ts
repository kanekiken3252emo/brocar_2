import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { and, eq, sql as dsql } from "drizzle-orm";
import { CAR_BRAND_META } from "@/lib/catalog/classifier";

/**
 * Список марок авто с количеством товаров в наличии.
 * Используется на странице /automarki для показа сетки марок.
 */
export async function GET() {
  try {
    const rows = await db.execute<{ brand: string; count: number }>(dsql`
      SELECT UNNEST(car_brands) AS brand, COUNT(*)::int AS count
      FROM products
      WHERE source = 'berg'
        AND stock > 0
        AND car_brands IS NOT NULL
      GROUP BY brand
      ORDER BY count DESC
    `);

    const countMap = new Map<string, number>();
    for (const r of rows) countMap.set(r.brand, Number(r.count));

    const brands = CAR_BRAND_META.map((m) => ({
      slug: m.slug,
      title: m.title,
      count: countMap.get(m.slug) ?? 0,
    })).filter((b) => b.count > 0);

    return NextResponse.json({ brands });
  } catch (error) {
    console.error("car-brands route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
