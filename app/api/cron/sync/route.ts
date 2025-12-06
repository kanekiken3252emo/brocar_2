import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, suppliers } from "@/lib/db/schema";
import vendorAAdapter from "@/lib/suppliers/vendorA";
import vendorBAdapter from "@/lib/suppliers/vendorB";
import { applyPricingSync } from "@/lib/pricing";
import { eq } from "drizzle-orm";

/**
 * Cron job endpoint to sync products from suppliers
 * In production, protect this with Vercel Cron or a secret token
 * 
 * Usage:
 * - Add to vercel.json: { "crons": [{ "path": "/api/cron/sync", "schedule": "0 */6 * * *" }] }
 * - Or call with X-CRON-TOKEN header
 */
export async function GET(request: NextRequest) {
  try {
    // Simple token-based protection
    const token = request.headers.get("x-cron-token");
    const expectedToken = process.env.CRON_SECRET_TOKEN;

    if (expectedToken && token !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return await performSync();
  } catch (error) {
    console.error("Cron sync error:", error);
    return NextResponse.json(
      { error: "Sync failed", details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

async function performSync() {
  const startTime = Date.now();
  let syncedCount = 0;
  let errorCount = 0;

  // Get or create suppliers
  const vendorASupplier = await getOrCreateSupplier("Vendor A", "vendorA");
  const vendorBSupplier = await getOrCreateSupplier("Vendor B", "vendorB");

  // Example: sync popular parts (in production, you'd have a catalog to iterate)
  const popularArticles = [
    { article: "12345", brand: "Bosch" },
    { article: "67890", brand: "Mann" },
    { article: "54321", brand: "Brembo" },
  ];

  for (const search of popularArticles) {
    try {
      // Search vendor A
      const vendorAResults = await vendorAAdapter.search(search);
      for (const item of vendorAResults) {
        await upsertProduct(item, vendorASupplier.id);
        syncedCount++;
      }

      // Search vendor B
      const vendorBResults = await vendorBAdapter.search(search);
      for (const item of vendorBResults) {
        await upsertProduct(item, vendorBSupplier.id);
        syncedCount++;
      }
    } catch (error) {
      console.error(`Error syncing ${search.article}:`, error);
      errorCount++;
    }
  }

  const duration = Date.now() - startTime;

  return NextResponse.json({
    success: true,
    syncedCount,
    errorCount,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
  });
}

async function getOrCreateSupplier(name: string, key: string) {
  const existing = await db.query.suppliers.findFirst({
    where: eq(suppliers.name, name),
  });

  if (existing) {
    return existing;
  }

  const [newSupplier] = await db
    .insert(suppliers)
    .values({
      name,
      apiBaseUrl: process.env[`${key.toUpperCase()}_URL`] || "",
      apiKey: process.env[`${key.toUpperCase()}_KEY`] || "",
    })
    .returning();

  return newSupplier;
}

async function upsertProduct(
  item: { article: string; brand?: string; name: string; price: number; stock: number },
  supplierId: string
) {
  const ourPrice = applyPricingSync(item.price, { brand: item.brand });

  // Check if product exists
  const existing = await db.query.products.findFirst({
    where: (products, { and, eq }) =>
      and(
        eq(products.article, item.article),
        eq(products.supplierId, supplierId)
      ),
  });

  if (existing) {
    // Update
    await db
      .update(products)
      .set({
        name: item.name,
        brand: item.brand || null,
        supplierPrice: item.price.toString(),
        ourPrice: ourPrice.toString(),
        stock: item.stock,
        updatedAt: new Date(),
      })
      .where(eq(products.id, existing.id));
  } else {
    // Insert
    await db.insert(products).values({
      article: item.article,
      brand: item.brand || null,
      name: item.name,
      supplierId,
      supplierPrice: item.price.toString(),
      ourPrice: ourPrice.toString(),
      stock: item.stock,
    });
  }
}




