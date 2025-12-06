import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/auth";

const createPaymentSchema = z.object({
  orderId: z.number(),
});

/**
 * Create payment for an order
 * This is a stub implementation for YooKassa/CloudPayments
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createPaymentSchema.parse(body);

    // Find order
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, validatedData.orderId),
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Verify order belongs to user
    if (order.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check order status
    if (!["pending", "awaiting_payment"].includes(order.status)) {
      return NextResponse.json(
        { error: "Order cannot be paid" },
        { status: 400 }
      );
    }

    const provider = process.env.PAYMENT_PROVIDER || "yookassa";
    const returnUrl =
      process.env.PAYMENT_RETURN_URL || "http://localhost:3000/";

    // TODO: Implement real payment provider integration
    if (provider === "yookassa") {
      // YooKassa stub
      const paymentId = `payment_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Update order with payment_id
      await db
        .update(orders)
        .set({ paymentId })
        .where(eq(orders.id, order.id));

      // TODO: Call YooKassa API to create payment
      // const yooKassaResponse = await createYooKassaPayment({
      //   amount: order.total,
      //   orderId: order.id,
      //   returnUrl,
      // });

      return NextResponse.json({
        provider: "yookassa",
        paymentId,
        confirmationUrl: `${returnUrl}?order_id=${order.id}&payment_success=true`,
        // In production, this would be the actual YooKassa confirmation URL
      });
    } else if (provider === "cloudpayments") {
      // CloudPayments stub
      const paymentId = `cp_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      await db
        .update(orders)
        .set({ paymentId })
        .where(eq(orders.id, order.id));

      // TODO: Prepare CloudPayments widget data
      return NextResponse.json({
        provider: "cloudpayments",
        paymentId,
        widgetData: {
          publicId: process.env.PAYMENT_SHOP_ID,
          description: `Заказ #${order.id}`,
          amount: order.total,
          currency: "RUB",
          invoiceId: order.id.toString(),
          accountId: user.id,
        },
      });
    }

    return NextResponse.json(
      { error: "Payment provider not configured" },
      { status: 500 }
    );
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




