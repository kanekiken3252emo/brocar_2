import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { createPayment, toAmountValue, type Receipt } from "@/lib/yookassa";
import { publicBaseUrl } from "@/lib/site-url";

const createPaymentSchema = z.object({
  orderId: z.number(),
});

/**
 * Создаёт платёж в ЮKassa для заказа и возвращает confirmation_url,
 * на который нужно перенаправить покупателя для оплаты.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { orderId } = createPaymentSchema.parse(body);

    // Находим заказ вместе с позициями (нужны для чека)
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: { items: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!["pending", "awaiting_payment"].includes(order.status)) {
      return NextResponse.json(
        { error: "Order cannot be paid" },
        { status: 400 }
      );
    }

    const amount = parseFloat(order.total);
    if (!(amount > 0)) {
      return NextResponse.json(
        { error: "Order total is invalid" },
        { status: 400 }
      );
    }

    // Куда ЮKassa вернёт покупателя после формы оплаты — на страницу его заказа.
    // Там же идёт активная сверка статуса (на случай, если вебхук ещё не пришёл)
    // и показывается экран «спасибо за заказ» / «ожидание оплаты».
    const returnUrl = `${publicBaseUrl(request)}/order/${order.id}`;

    // Чек по 54-ФЗ — формируем только если включён флаг PAYMENT_SEND_RECEIPT.
    // Требует контакт покупателя (email) и корректные коды НДС/налогообложения.
    let receipt: Receipt | undefined;
    if (process.env.PAYMENT_SEND_RECEIPT === "true") {
      const vatCode = parseInt(process.env.PAYMENT_VAT_CODE || "1", 10); // 1 = без НДС
      const taxSystemCode = process.env.PAYMENT_TAX_SYSTEM_CODE
        ? parseInt(process.env.PAYMENT_TAX_SYSTEM_CODE, 10)
        : undefined;

      receipt = {
        customer: { email: user.email ?? undefined },
        tax_system_code: taxSystemCode,
        items: order.items.map((item) => ({
          description: item.name.slice(0, 128),
          quantity: item.qty.toFixed(2),
          amount: {
            value: toAmountValue(parseFloat(item.price) * item.qty),
            currency: "RUB",
          },
          vat_code: vatCode,
          payment_subject: "commodity", // товар
          payment_mode: "full_payment", // полный расчёт
        })),
      };
    }

    // Создаём платёж в ЮKassa
    const payment = await createPayment({
      amount,
      description: `Заказ №${order.id} — BroCar`,
      returnUrl,
      metadata: { order_id: String(order.id) },
      receipt,
    });

    const confirmationUrl = payment.confirmation?.confirmation_url;
    if (!confirmationUrl) {
      throw new Error("ЮKassa не вернула confirmation_url");
    }

    // Сохраняем реальный payment.id и переводим заказ в ожидание оплаты
    await db
      .update(orders)
      .set({ paymentId: payment.id, status: "awaiting_payment" })
      .where(eq(orders.id, order.id));

    return NextResponse.json({
      provider: "yookassa",
      paymentId: payment.id,
      confirmationUrl,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Payment creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
