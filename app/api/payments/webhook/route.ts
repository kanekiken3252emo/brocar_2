import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, carts, cartItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getPayment } from "@/lib/yookassa";
import { STATUS_AFTER_PAYMENT } from "@/lib/order-status";

/**
 * Обработчик уведомлений ЮKassa (HTTP-уведомления).
 * URL для ЛК: https://brocarparts.ru/api/payments/webhook
 *
 * Безопасность: тело уведомления НЕ является доверенным. Мы берём из него
 * только payment.id, а актуальный статус запрашиваем напрямую у API ЮKassa
 * по этому id (через секретный ключ). Подделать такое уведомление нельзя —
 * злоумышленник не знает реальный id платежа и не пройдёт сверку статуса.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const event: string | undefined = body?.event;
    const paymentId: string | undefined = body?.object?.id;

    if (!paymentId) {
      // Нет id — нечего проверять, но отвечаем 200, чтобы не было ретраев.
      return NextResponse.json({ success: false, error: "No payment id" });
    }

    // Реагируем только на интересующие события
    if (event !== "payment.succeeded" && event !== "payment.canceled") {
      return NextResponse.json({ success: true, ignored: event });
    }

    // Сверяем статус напрямую с API ЮKassa
    const payment = await getPayment(paymentId);
    const orderId = payment.metadata?.order_id;

    if (!orderId) {
      console.warn(`Webhook: платёж ${paymentId} без order_id в metadata`);
      return NextResponse.json({ success: false, error: "No order_id" });
    }

    const orderIdNum = parseInt(orderId, 10);

    if (payment.status === "succeeded" && payment.paid) {
      const [paidOrder] = await db
        .update(orders)
        .set({ status: STATUS_AFTER_PAYMENT, paymentId: payment.id })
        .where(eq(orders.id, orderIdNum))
        .returning();
      console.log(`Order ${orderIdNum} paid → ${STATUS_AFTER_PAYMENT} (${payment.id})`);

      // Очищаем корзину покупателя только после успешной оплаты.
      if (paidOrder?.userId) {
        const cart = await db.query.carts.findFirst({
          where: eq(carts.userId, paidOrder.userId),
        });
        if (cart) {
          await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
        }
      }
    } else if (payment.status === "canceled") {
      await db
        .update(orders)
        .set({ status: "canceled" })
        .where(eq(orders.id, orderIdNum));
      console.log(`Order ${orderIdNum} marked as canceled (${payment.id})`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    // Возвращаем 200, чтобы ЮKassa не заваливала ретраями. Реальную проблему
    // увидим в логах; статус всё равно можно сверить вручную в ЛК.
    return NextResponse.json({ success: false, error: "Processing error" });
  }
}