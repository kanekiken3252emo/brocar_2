import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { and, eq, sql as dsql } from "drizzle-orm";
import { CATEGORY_META, getCategoryMeta } from "@/lib/catalog/classifier";

/**
 * Список категорий с количеством товаров в наличии.
 * Используется для построения меню/боковой навигации.
 */
export async function GET() {
  try {
    const rows = await db
      .select({
        slug: products.categorySlug,
        count: dsql<number>`COUNT(*)::int`,
      })
      .from(products)
      .where(
        and(
          eq(products.source, "berg"),
          dsql`${products.stock} > 0`,
          dsql`${products.categorySlug} IS NOT NULL`
        )
      )
      .groupBy(products.categorySlug);

    const countMap = new Map<string, number>();
    for (const r of rows) {
      if (r.slug) countMap.set(r.slug, r.count);
    }

    // Возвращаем в порядке, заданном в CATEGORY_META, чтобы меню было упорядочено.
    const categories = CATEGORY_META.map((m) => ({
      slug: m.slug,
      title: m.title,
      description: m.description ?? null,
      count: countMap.get(m.slug) ?? 0,
    })).filter((c) => c.count > 0);

    // Категории, которые появились в БД, но не описаны в CATEGORY_META
    const unknownSlugs = [...countMap.keys()].filter(
      (s) => !getCategoryMeta(s)
    );
    for (const slug of unknownSlugs) {
      categories.push({
        slug,
        title: slug,
        description: null,
        count: countMap.get(slug) ?? 0,
      });
    }

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Catalog categories route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
