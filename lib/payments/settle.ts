import { db } from "@/lib/db";
import { orders, orderItems, carts, cartItems, profiles } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getPayment } from "@/lib/yookassa";
import { STATUS_AFTER_PAYMENT } from "@/lib/order-status";
import { sendOrderNotification, sendOrderPlacedToCustomer } from "@/lib/email";

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
        with: { items: true },
      });
      if (cart) {
        // Удаляем из корзины ТОЛЬКО оплаченные позиции (совпадение товар+цена с
        // позициями заказа). При частичном заказе (покупатель отметил не всё)
        // неоплаченные товары остаются в корзине. Ключ (productId, price)
        // уникален для строки корзины, поэтому совпадение однозначно.
        const orderRows = await db
          .select({ productId: orderItems.productId, price: orderItems.price })
          .from(orderItems)
          .where(eq(orderItems.orderId, orderId));
        const key = (productId: number | null, price: unknown) =>
          `${productId}|${parseFloat(String(price ?? "0"))}`;
        const paidKeys = new Set(
          orderRows.map((r) => key(r.productId, r.price))
        );
        const toDelete = cart.items
          .filter((it) => paidKeys.has(key(it.productId, it.price)))
          .map((it) => it.id);
        if (toDelete.length)
          await db.delete(cartItems).where(inArray(cartItems.id, toDelete));

        // Промокод снимаем, только если корзина ОПУСТЕЛА — иначе оставшиеся
        // товары сохраняют право применить его к следующему заказу. Скидка уже
        // зафиксирована снимком в оплаченном заказе.
        if (cart.promoCode && cart.items.length - toDelete.length === 0)
          await db
            .update(carts)
            .set({ promoCode: null })
            .where(eq(carts.id, cart.id));
      }
    }

    // Письмо магазину «ОПЛАЧЕН» — только на самом переходе (paid вернулся из
    // UPDATE по PRE_PAYMENT_STATUSES), поэтому повторные сверки писем не дублируют.
    // Сбой почты не должен ломать приёмку оплаты — только логируем.
    if (paid) {
      const full = await db.query.orders.findFirst({
        where: eq(orders.id, orderId),
        with: { items: true },
      });
      const profile = paid.userId
        ? await db.query.profiles
            .findFirst({ where: eq(profiles.id, paid.userId) })
            .catch(() => null)
        : null;

      if (full) {
        const emailItems = full.items.map((it) => ({
          name: it.name,
          article: it.article,
          brand: it.brand,
          qty: it.qty,
          price: it.price,
        }));

        // Письмо магазину «ОПЛАЧЕН». Сбой почты не должен ломать приёмку оплаты.
        try {
          await sendOrderNotification(
            {
              orderId: full.id,
              total: parseFloat(full.total),
              customerEmail: profile?.email ?? "—",
              customerName: profile?.fullName,
              customerPhone: profile?.phone,
              contactEmail: profile?.contactEmail,
              telegram: profile?.telegram,
              whatsapp: profile?.whatsapp,
              vk: profile?.vk,
              maxMessenger: profile?.maxMessenger,
              items: emailItems,
            },
            { kind: "paid" }
          );
        } catch (mailError) {
          console.error("Paid order notification email failed:", mailError);
        }

        // Письмо ПОКУПАТЕЛЮ «заказ принят в работу» — теперь на УСПЕШНОЙ ОПЛАТЕ
        // (раньше слалось при создании заказа, до оплаты). Отдельный try, чтобы
        // сбой одного письма не мешал другому.
        try {
          await sendOrderPlacedToCustomer({
            to: profile?.contactEmail || profile?.email || "",
            orderId: full.id,
            total: parseFloat(full.total),
            items: emailItems,
          });
        } catch (mailError) {
          console.error("Customer paid confirmation email failed:", mailError);
        }
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
