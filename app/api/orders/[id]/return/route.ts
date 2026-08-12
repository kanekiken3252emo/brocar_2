import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { sendReturnRequestNotification } from "@/lib/email";

export const runtime = "nodejs";

/**
 * Заявка «Возврат / гарантия» по заказу. Одна кнопка на странице заказа, но тип
 * (возврат/гарантия) выбирает клиент — письма магазину уходят с разной темой.
 * Ничего в заказе не меняем: магазин связывается и решает вопрос вручную.
 * POST /api/orders/:id/return  { type: "return" | "warranty", comment?: string }
 */
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

  const body = await request.json().catch(() => ({}));
  const type = body.type === "warranty" ? "warranty" : "return";
  const comment =
    typeof body.comment === "string" && body.comment.trim()
      ? body.comment.trim().slice(0, 2000)
      : null;

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Контакты клиента для письма — из профиля (как в уведомлениях о заказах).
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  try {
    await sendReturnRequestNotification({
      orderId,
      type,
      customerName: profile?.fullName ?? null,
      phone: profile?.phone ?? null,
      email: profile?.contactEmail ?? profile?.email ?? user.email ?? null,
      comment,
    });
  } catch (e) {
    console.error("Return request email failed:", e);
    return NextResponse.json(
      { error: "Не удалось отправить заявку. Позвоните нам, пожалуйста." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
