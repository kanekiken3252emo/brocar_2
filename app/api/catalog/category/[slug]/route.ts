import { NextRequest, NextResponse } from "next/server";
import {
  searchAllSuppliers,
  groupOffers,
  type SupplierItem,
} from "@/lib/suppliers/adapter";
import bergAdapter from "@/lib/suppliers/berg";
import rosskoAdapter from "@/lib/suppliers/rossko";
import shateMAdapter from "@/lib/suppliers/shate-m";
import { applyPricingSync } from "@/lib/pricing";
import { getCategoryBySlug } from "@/lib/catalog/categories";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const category = getCategoryBySlug(slug);

    if (!category) {
      return NextResponse.json(
        { error: `Category '${slug}' not found` },
        { status: 404 }
      );
    }

    const adapters = [bergAdapter, rosskoAdapter, shateMAdapter];

    const perArticle = await Promise.all(
      category.articles.map((a) =>
        searchAllSuppliers(adapters, { article: a.article, brand: a.brand }, 10000)
          .catch((e) => {
            console.error(`Category ${slug}: failed for ${a.brand} ${a.article}`, e);
            return [] as SupplierItem[];
          })
      )
    );

    const items: SupplierItem[] = perArticle.flat();
    const groups = groupOffers(items, (base, ctx) => applyPricingSync(base, ctx));

    return NextResponse.json({
      slug: category.slug,
      title: category.title,
      description: category.description ?? null,
      groups,
      count: groups.length,
    });
  } catch (error) {
    console.error("Catalog category route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
