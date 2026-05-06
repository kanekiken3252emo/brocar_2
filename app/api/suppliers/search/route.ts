import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { searchAllSuppliers, groupOffers } from "@/lib/suppliers/adapter";
import bergAdapter from "@/lib/suppliers/berg";
import rosskoAdapter from "@/lib/suppliers/rossko";
import shateMAdapter from "@/lib/suppliers/shate-m";
import forumAutoAdapter from "@/lib/suppliers/forum-auto";
import armtekAdapter from "@/lib/suppliers/armtek";
import { applyPricingSync } from "@/lib/pricing";

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

    const adapters = [bergAdapter, rosskoAdapter, shateMAdapter, forumAutoAdapter, armtekAdapter];
    const items = await searchAllSuppliers(adapters, validatedData);

    const groups = groupOffers(items, (base, ctx) =>
      applyPricingSync(base, ctx)
    );

    return NextResponse.json({
      groups,
      count: groups.length,
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




