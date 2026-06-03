import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { ADMIN_SETTABLE_STATUSES } from "@/lib/order-status";

const patchSchema = z.object({
  status: z.enum(ADMIN_SETTABLE_STATUSES),
});

/**
 * Смена статуса заказа администратором.
 * PATCH /api/admin/orders/:id  { status: "processing" | ... }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    const body = await request.json();
    const { status } = patchSchema.parse(body);

    const [updated] = await db
      .update(orders)
      .set({ status })
      .where(eq(orders.id, orderId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ order: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Недопустимый статус", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Admin order update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
