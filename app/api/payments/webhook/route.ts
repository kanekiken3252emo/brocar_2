import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Payment webhook handler
 * Receives notifications from payment provider about payment status
 * This is a stub implementation - in production, you must verify signatures
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // TODO: Verify webhook signature based on provider
    // For YooKassa: verify using HMAC-SHA256
    // For CloudPayments: verify using MD5 hash

    const provider = process.env.PAYMENT_PROVIDER || "yookassa";

    if (provider === "yookassa") {
      // YooKassa webhook format stub
      const { event, object } = body;

      if (event === "payment.succeeded") {
        const paymentId = object?.id;
        const metadata = object?.metadata;
        const orderId = metadata?.order_id;

        if (orderId) {
          // Update order status
          await db
            .update(orders)
            .set({
              status: "paid",
              paymentId,
            })
            .where(eq(orders.id, parseInt(orderId, 10)));

          console.log(`Order ${orderId} marked as paid`);
        }
      }
    } else if (provider === "cloudpayments") {
      // CloudPayments webhook format stub
      const { Status, InvoiceId, TransactionId } = body;

      if (Status === "Completed") {
        const orderId = parseInt(InvoiceId, 10);

        if (!isNaN(orderId)) {
          await db
            .update(orders)
            .set({
              status: "paid",
              paymentId: TransactionId,
            })
            .where(eq(orders.id, orderId));

          console.log(`Order ${orderId} marked as paid`);
        }
      }
    }

    // Always return 200 to payment provider
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    // Still return 200 to avoid retry storms
    return NextResponse.json({ success: false, error: "Processing error" });
  }
}




