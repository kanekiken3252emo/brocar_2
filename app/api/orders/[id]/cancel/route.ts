import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

/**
 * Отмена покупателем своего НЕоплаченного заказа.
 * POST /api/orders/:id/cancel
 *
 * Разрешено только из «до-оплатных» статусов (pending / awaiting_payment).
 * Оплаченный/принятый заказ так не отменить — это возврат средств, его делает
 * админ. Брошенный платёж в ЮKassa отменится сам по истечении срока.
 */
const PRE_PAYMENT_STATUSES = ["pending", "awaiting_payment"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const orderId = parseInt(id, 10);
  if (Number.isNaN(orderId)) {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
  }

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.userId !== user.id && !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!PRE_PAYMENT_STATUSES.includes(order.status)) {
    return NextResponse.json(
      { error: "Этот заказ уже нельзя отменить" },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(orders)
    .set({ status: "canceled" })
    .where(
      and(eq(orders.id, orderId), inArray(orders.status, PRE_PAYMENT_STATUSES))
    )
    .returning();

  return NextResponse.json({ ok: true, status: updated?.status ?? "canceled" });
}
