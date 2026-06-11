import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { searchAllSuppliers, groupOffers } from "@/lib/suppliers/adapter";
import bergAdapter from "@/lib/suppliers/berg";
import rosskoAdapter from "@/lib/suppliers/rossko";
import shateMAdapter from "@/lib/suppliers/shate-m";
import forumAutoAdapter from "@/lib/suppliers/forum-auto";
import armtekAdapter from "@/lib/suppliers/armtek";
import autotradeAdapter from "@/lib/suppliers/autotrade";
import partKomAdapter from "@/lib/suppliers/partkom";
import { applyPricingSync } from "@/lib/pricing";
import { enrichGroupsWithImages } from "@/lib/product-images";

const searchSchema = z.object({
  article: z.string().optional(),
  brand: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = searchSchema.parse(body);

    if (!validatedData.article && !validatedData.brand) {
      return NextResponse.json(
        { error: "At least one of article or brand is required" },
        { status: 400 }
      );
    }

    const adapters = [
      bergAdapter,
      rosskoAdapter,
      shateMAdapter,
      forumAutoAdapter,
      armtekAdapter,
      autotradeAdapter,
      partKomAdapter,
    ];
    const items = await searchAllSuppliers(adapters, validatedData);

    const groups = groupOffers(items, (base, ctx) =>
      applyPricingSync(base, ctx)
    );

    // Подсеваем картинки из кэша product_images, чтобы клиент не делал
    // N round-trip'ов к /api/product-image при рендере грида карточек.
    const enriched = await enrichGroupsWithImages(groups);

    return NextResponse.json({
      groups: enriched,
      count: enriched.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Supplier search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}




