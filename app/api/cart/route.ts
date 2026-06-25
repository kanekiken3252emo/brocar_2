import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { carts, cartItems, products } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { generateSessionId } from "@/lib/utils";
import { validatePromo, discountAmount } from "@/lib/promo";

const addToCartSchema = z.object({
  action: z.enum(["add", "remove", "update"]),
  productId: z.number(),
  qty: z.number().min(1).optional(),
});

const addFromSupplierSchema = z.object({
  action: z.literal("addFromSupplier"),
  article: z.string().min(1),
  brand: z.string().optional().default(""),
  name: z.string().min(1),
  ourPrice: z.number().nonnegative(),
  supplierPrice: z.number().nonnegative().optional(),
  stock: z.number().int().nonnegative().optional().default(0),
  qty: z.number().int().min(1).optional().default(1),
  deliveryDays: z.number().int().nullable().optional(),
  supplier: z.string().nullable().optional(),
});

async function upsertProductByArticle(input: {
  article: string;
  brand: string;
  name: string;
  ourPrice: number;
  supplierPrice: number;
  stock: number;
}): Promise<number> {
  const existing = await db.query.products.findFirst({
    where: (p, { and, eq }) =>
      and(eq(p.article, input.article), eq(p.brand, input.brand)),
  });

  if (existing) {
    await db
      .update(products)
      .set({
        name: input.name,
        ourPrice: input.ourPrice.toString(),
        supplierPrice: input.supplierPrice.toString(),
        stock: input.stock,
        updatedAt: new Date(),
      })
      .where(eq(products.id, existing.id));
    return existing.id;
  }

  const [inserted] = await db
    .insert(products)
    .values({
      article: input.article,
      brand: input.brand || null,
      name: input.name,
      ourPrice: input.ourPrice.toString(),
      supplierPrice: input.supplierPrice.toString(),
      stock: input.stock,
    })
    .returning();

  return inserted.id;
}

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
    deliveryDays: item.deliveryDays,
    product: {
      id: item.product.id,
      article: item.product.article,
      brand: item.product.brand,
      name: item.product.name,
      price: parseFloat(item.product.ourPrice),
      stock: item.product.stock,
    },
  }));

  // Суммируем с округлением каждой позиции до копеек — так же, как при
  // создании заказа (см. /api/orders), чтобы предпросмотр совпал с чеком.
  const subtotal = Number(
    items
      .reduce((sum, item) => sum + Number((item.product.price * item.qty).toFixed(2)), 0)
      .toFixed(2)
  );

  // Применённый промокод (хранится при корзине). Валидируем серверно: если код
  // отключили/истёк после применения — скидку не показываем, total = subtotal.
  let promo: { code: string; discountPct: number; discountAmount: number } | null =
    null;
  if (cart.promoCode) {
    const check = await validatePromo(cart.promoCode);
    if (check.ok) {
      const amount = discountAmount(subtotal, check.promo.discountPct);
      if (amount > 0)
        promo = {
          code: check.promo.code,
          discountPct: check.promo.discountPct,
          discountAmount: amount,
        };
    }
  }

  const total = Number((subtotal - (promo?.discountAmount ?? 0)).toFixed(2));

  return {
    id: cart.id,
    items,
    subtotal,
    promo,
    total,
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

    // Ветка для добавления прямо от поставщика: upsert товара → обычный "add"
    if (body && body.action === "addFromSupplier") {
      const data = addFromSupplierSchema.parse(body);
      const cart = await getOrCreateCart(user?.id || null, sessionId!);

      const productId = await upsertProductByArticle({
        article: data.article,
        brand: data.brand,
        name: data.name,
        ourPrice: data.ourPrice,
        supplierPrice: data.supplierPrice ?? data.ourPrice,
        stock: data.stock,
      });

      const existingItem = await db.query.cartItems.findFirst({
        where: and(
          eq(cartItems.cartId, cart.id),
          eq(cartItems.productId, productId)
        ),
      });

      if (existingItem) {
        await db
          .update(cartItems)
          .set({
            qty: existingItem.qty + data.qty,
            deliveryDays: data.deliveryDays ?? existingItem.deliveryDays,
            supplier: data.supplier ?? existingItem.supplier,
          })
          .where(eq(cartItems.id, existingItem.id));
      } else {
        await db.insert(cartItems).values({
          cartId: cart.id,
          productId,
          qty: data.qty,
          deliveryDays: data.deliveryDays ?? null,
          supplier: data.supplier ?? null,
        });
      }

      const cartData = await getCartWithItems(cart.id);
      const response = NextResponse.json(cartData);
      if (!user) {
        response.cookies.set("session_id", sessionId!, {
          httpOnly: true,
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 30,
        });
      }
      return response;
    }

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




