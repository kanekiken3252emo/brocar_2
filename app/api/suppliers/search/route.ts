import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { searchAllSuppliers } from "@/lib/suppliers/adapter";
import bergAdapter from "@/lib/suppliers/berg";
import { applyPricingSync } from "@/lib/pricing";

const searchSchema = z.object({
  article: z.string().optional(),
  brand: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = searchSchema.parse(body);

    // Require at least article or brand
    if (!validatedData.article && !validatedData.brand) {
      return NextResponse.json(
        { error: "At least one of article or brand is required" },
        { status: 400 }
      );
    }

    // Search only Berg.ru (real API)
    const adapters = [bergAdapter];
    const supplierItems = await searchAllSuppliers(adapters, validatedData);

    // Apply our pricing to each item
    const itemsWithPricing = supplierItems.map((item) => ({
      article: item.article,
      brand: item.brand || "",
      name: item.name,
      supplierPrice: item.price,
      ourPrice: applyPricingSync(item.price, { brand: item.brand }),
      stock: item.stock,
      supplier: item.supplier,
    }));

    return NextResponse.json({
      items: itemsWithPricing,
      count: itemsWithPricing.length,
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




