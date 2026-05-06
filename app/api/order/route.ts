import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { orders, orderItems, carts, cartItems, products } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/auth";

const createOrderSchema = z.object({
  fromCart: z.boolean().optional(),
  items: z
    .array(
      z.object({
        productId: z.number(),
        qty: z.number().min(1),
      })
    )
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createOrderSchema.parse(body);

    let orderTotal = 0;
    let itemsToAdd: Array<{
      productId: number;
      qty: number;
      name: string;
      article: string;
      brand: string | null;
      price: string;
    }> = [];

    if (validatedData.fromCart !== false) {
      // Create order from cart
      const cookieStore = await cookies();
      const sessionId = cookieStore.get("session_id")?.value;

      // Find user's cart
      let cart;
      if (user) {
        cart = await db.query.carts.findFirst({
          where: eq(carts.userId, user.id),
          with: {
            items: {
              with: {
                product: true,
              },
            },
          },
        });
      } else if (sessionId) {
        cart = await db.query.carts.findFirst({
          where: eq(carts.sessionId, sessionId),
          with: {
            items: {
              with: {
                product: true,
              },
            },
          },
        });
      }

      if (!cart || cart.items.length === 0) {
        return NextResponse.json(
          { error: "Cart is empty" },
          { status: 400 }
        );
      }

      // Build order items from cart
      itemsToAdd = cart.items.map((item) => {
        const itemTotal =
          parseFloat(item.product.ourPrice) * item.qty;
        orderTotal += itemTotal;

        return {
          productId: item.product.id,
          qty: item.qty,
          name: item.product.name,
          article: item.product.article,
          brand: item.product.brand,
          price: item.product.ourPrice,
        };
      });
    } else if (validatedData.items) {
      // Create order from provided items
      // Fixed: using products schema import
      for (const item of validatedData.items) {
        const product = await db.query.products.findFirst({
          where: eq(products.id, item.productId),
        });

        if (!product) {
          return NextResponse.json(
            { error: `Product ${item.productId} not found` },
            { status: 404 }
          );
        }

        const itemTotal = parseFloat(product.ourPrice) * item.qty;
        orderTotal += itemTotal;

        itemsToAdd.push({
          productId: product.id,
          qty: item.qty,
          name: product.name,
          article: product.article,
          brand: product.brand,
          price: product.ourPrice,
        });
      }
    } else {
      return NextResponse.json(
        { error: "No items provided" },
        { status: 400 }
      );
    }

    // Create order
    const [order] = await db
      .insert(orders)
      .values({
        userId: user.id,
        status: "awaiting_payment",
        total: orderTotal.toFixed(2),
      })
      .returning();

    // Add order items
    await db.insert(orderItems).values(
      itemsToAdd.map((item) => ({
        orderId: order.id,
        productId: item.productId,
        name: item.name,
        article: item.article,
        brand: item.brand,
        qty: item.qty,
        price: item.price,
      }))
    );

    // Clear cart if order was created from cart
    if (validatedData.fromCart !== false) {
      const cart = await db.query.carts.findFirst({
        where: eq(carts.userId, user.id),
      });
      if (cart) {
        await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
      }
    }

    return NextResponse.json({
      orderId: order.id,
      status: order.status,
      total: order.total,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Order creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userOrders = await db.query.orders.findMany({
      where: eq(orders.userId, user.id),
      orderBy: (orders, { desc }) => [desc(orders.createdAt)],
    });

    return NextResponse.json({ orders: userOrders });
  } catch (error) {
    console.error("Orders list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}




