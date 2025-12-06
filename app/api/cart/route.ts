import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { carts, cartItems, products } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { generateSessionId } from "@/lib/utils";

const addToCartSchema = z.object({
  action: z.enum(["add", "remove", "update"]),
  productId: z.number(),
  qty: z.number().min(1).optional(),
});

async function getOrCreateCart(userId: string | null, sessionId: string) {
  // Try to find existing cart
  let cart;

  if (userId) {
    cart = await db.query.carts.findFirst({
      where: eq(carts.userId, userId),
    });
  } else {
    cart = await db.query.carts.findFirst({
      where: eq(carts.sessionId, sessionId),
    });
  }

  // Create cart if it doesn't exist
  if (!cart) {
    const [newCart] = await db
      .insert(carts)
      .values({
        userId: userId || null,
        sessionId: userId ? null : sessionId,
      })
      .returning();
    cart = newCart;
  }

  return cart;
}

async function getCartWithItems(cartId: number) {
  const cart = await db.query.carts.findFirst({
    where: eq(carts.id, cartId),
    with: {
      items: {
        with: {
          product: true,
        },
      },
    },
  });

  if (!cart) return null;

  const items = cart.items.map((item) => ({
    id: item.id,
    productId: item.productId,
    qty: item.qty,
    product: {
      id: item.product.id,
      article: item.product.article,
      brand: item.product.brand,
      name: item.product.name,
      price: parseFloat(item.product.ourPrice),
      stock: item.product.stock,
    },
  }));

  const subtotal = items.reduce(
    (sum, item) => sum + item.product.price * item.qty,
    0
  );

  return {
    id: cart.id,
    items,
    subtotal,
    total: subtotal, // Can add shipping, tax, etc. here
  };
}

export async function GET() {
  try {
    const user = await getUser();
    const cookieStore = await cookies();
    let sessionId = cookieStore.get("session_id")?.value;

    if (!sessionId && !user) {
      return NextResponse.json({
        items: [],
        subtotal: 0,
        total: 0,
      });
    }

    if (!sessionId) {
      sessionId = generateSessionId();
    }

    const cart = await getOrCreateCart(user?.id || null, sessionId);
    const cartData = await getCartWithItems(cart.id);

    const response = NextResponse.json(cartData || { items: [], subtotal: 0, total: 0 });

    // Set session cookie if not authenticated
    if (!user) {
      response.cookies.set("session_id", sessionId, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    }

    return response;
  } catch (error) {
    console.error("Cart GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    const cookieStore = await cookies();
    let sessionId = cookieStore.get("session_id")?.value;

    if (!sessionId && !user) {
      sessionId = generateSessionId();
    }

    const body = await request.json();
    const validatedData = addToCartSchema.parse(body);

    const cart = await getOrCreateCart(user?.id || null, sessionId!);

    // Handle different actions
    switch (validatedData.action) {
      case "add": {
        // Check if item already exists in cart
        const existingItem = await db.query.cartItems.findFirst({
          where: and(
            eq(cartItems.cartId, cart.id),
            eq(cartItems.productId, validatedData.productId)
          ),
        });

        if (existingItem) {
          // Update quantity
          await db
            .update(cartItems)
            .set({ qty: existingItem.qty + (validatedData.qty || 1) })
            .where(eq(cartItems.id, existingItem.id));
        } else {
          // Add new item
          await db.insert(cartItems).values({
            cartId: cart.id,
            productId: validatedData.productId,
            qty: validatedData.qty || 1,
          });
        }
        break;
      }

      case "remove": {
        await db
          .delete(cartItems)
          .where(
            and(
              eq(cartItems.cartId, cart.id),
              eq(cartItems.productId, validatedData.productId)
            )
          );
        break;
      }

      case "update": {
        if (validatedData.qty === 0) {
          // Remove item if qty is 0
          await db
            .delete(cartItems)
            .where(
              and(
                eq(cartItems.cartId, cart.id),
                eq(cartItems.productId, validatedData.productId)
              )
            );
        } else {
          await db
            .update(cartItems)
            .set({ qty: validatedData.qty })
            .where(
              and(
                eq(cartItems.cartId, cart.id),
                eq(cartItems.productId, validatedData.productId)
              )
            );
        }
        break;
      }
    }

    const cartData = await getCartWithItems(cart.id);
    const response = NextResponse.json(cartData);

    // Set session cookie if not authenticated
    if (!user) {
      response.cookies.set("session_id", sessionId!, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    }

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Cart POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}




