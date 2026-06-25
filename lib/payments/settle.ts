import { db } from "@/lib/db";
import { orders, carts, cartItems } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getPayment } from "@/lib/yookassa";
import { STATUS_AFTER_PAYMENT } from "@/lib/order-status";

/**
 * Статусы, из которых заказ ещё можно перевести оплатой. Защита от того, чтобы
 * запоздавшее уведомление/сверка НЕ откатили заказ, который админ уже двинул
 * дальше (processing, issued и т.п.), и не отменили уже оплаченный.
 */
const PRE_PAYMENT_STATUSES = ["pending", "awaiting_payment"];

export interface SettleResult {
  orderId: number | null;
  /** Итоговый статус заказа после сверки: "accepted" | "canceled" | null (платёж ещё в обработке у ЮKassa). */
  status: string | null;
  /** Реальный статус платежа в ЮKassa. */
  paymentStatus: string;
}

/**
 * Сверяет платёж напрямую с API ЮKassa и приводит статус заказа в соответствие.
 *
 * Идемпотентна и безопасна: order_id берём из metadata самого платежа (а не из
 * недоверенного тела вебхука), переход делаем только из «до-оплатных» статусов.
 * Поэтому функцию можно звать сколько угодно раз — и из вебхука, и со страницы
 * заказа, когда покупатель вернулся с оплаты раньше, чем пришёл вебхук.
 *
 * Возвращает итоговый статус заказа (или null, если ЮKassa ещё держит платёж в
 * pending — например, юзер ушёл со страницы оплаты, не заплатив).
 */
export async function settleByPaymentId(paymentId: string): Promise<SettleResult> {
  const payment = await getPayment(paymentId);
  const orderId = payment.metadata?.order_id
    ? parseInt(payment.metadata.order_id, 10)
    : null;

  if (!orderId || Number.isNaN(orderId)) {
    return { orderId: null, status: null, paymentStatus: payment.status };
  }

  // Успешная оплата → принимаем заказ и чистим корзину покупателя.
  if (payment.status === "succeeded" && payment.paid) {
    const [paid] = await db
      .update(orders)
      .set({ status: STATUS_AFTER_PAYMENT, paymentId: payment.id })
      .where(
        and(eq(orders.id, orderId), inArray(orders.status, PRE_PAYMENT_STATUSES))
      )
      .returning();

    if (paid?.userId) {
      const cart = await db.query.carts.findFirst({
        where: eq(carts.userId, paid.userId),
      });
      if (cart) {
        await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
        // Снимаем промокод вместе с очисткой корзины — иначе он «прилипнет»
        // к следующему заказу. Скидка уже зафиксирована снимком в оплаченном заказе.
        if (cart.promoCode)
          await db
            .update(carts)
            .set({ promoCode: null })
            .where(eq(carts.id, cart.id));
      }
    }
    return { orderId, status: STATUS_AFTER_PAYMENT, paymentStatus: payment.status };
  }

  // Платёж отменён → отменяем заказ (только если он ещё ждал оплату).
  if (payment.status === "canceled") {
    await db
      .update(orders)
      .set({ status: "canceled" })
      .where(
        and(eq(orders.id, orderId), inArray(orders.status, PRE_PAYMENT_STATUSES))
      );
    return { orderId, status: "canceled", paymentStatus: payment.status };
  }

  // pending / waiting_for_capture — оплата ещё не завершена.
  return { orderId, status: null, paymentStatus: payment.status };
}
