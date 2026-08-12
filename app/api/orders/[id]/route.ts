import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { hideOrder } from "@/lib/hidden-orders";

export const runtime = "nodejs";

/**
 * «Удаление» заказа покупателем из личного кабинета. На самом деле — мягкое
 * скрытие: заказ пропадает из кабинета клиента, но остаётся у магазина (админка),
 * т.к. это финансовая запись. См. lib/hidden-orders.ts.
 * DELETE /api/orders/:id
 */
export async function DELETE(
  _request: NextRequest,
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
  // Скрыть можно только СВОЙ заказ (админ пусть удаляет через свою панель).
  if (order.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await hideOrder(user.id, orderId);
  return NextResponse.json({ ok: true });
}
