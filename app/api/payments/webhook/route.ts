import { NextRequest, NextResponse } from "next/server";
import { settleByPaymentId } from "@/lib/payments/settle";

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

    // Вся логика сверки и обновления заказа — в settleByPaymentId (та же, что и на
    // странице заказа). order_id берётся из metadata платежа, статус — из API ЮKassa.
    const { orderId, status } = await settleByPaymentId(paymentId);

    if (!orderId) {
      console.warn(`Webhook: платёж ${paymentId} без order_id в metadata`);
      return NextResponse.json({ success: false, error: "No order_id" });
    }

    console.log(`Webhook: заказ ${orderId} → ${status ?? "без изменений"} (${paymentId})`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    // Возвращаем 200, чтобы ЮKassa не заваливала ретраями. Реальную проблему
    // увидим в логах; статус всё равно можно сверить вручную в ЛК.
    return NextResponse.json({ success: false, error: "Processing error" });
  }
}