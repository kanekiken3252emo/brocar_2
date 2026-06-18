import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { orders, orderItems, profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { ADMIN_SETTABLE_STATUSES } from "@/lib/order-status";
import { sendOrderReadyToCustomer } from "@/lib/email";

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

    // Письмо покупателю, когда заказ готов к получению. Сбой письма не должен
    // ломать смену статуса — только логируем.
    if (status === "ready") {
      try {
        const [items, customer] = await Promise.all([
          db.query.orderItems.findMany({
            where: eq(orderItems.orderId, orderId),
          }),
          updated.userId
            ? db.query.profiles.findFirst({
                where: eq(profiles.id, updated.userId),
              })
            : Promise.resolve(null),
        ]);
        await sendOrderReadyToCustomer({
          to: customer?.contactEmail || customer?.email || "",
          orderId: updated.id,
          total: Number(updated.total),
          items: items.map((i) => ({
            name: i.name,
            article: i.article,
            brand: i.brand,
            qty: i.qty,
            price: i.price,
          })),
        });
      } catch (mailError) {
        console.error("Order ready email failed:", mailError);
      }
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
