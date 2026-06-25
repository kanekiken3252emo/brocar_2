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

/**
 * Переносит позиции из одной корзины в другую: одинаковый товар — суммируем
 * количество, новый — просто перевешиваем на целевую. Источник после вызова
 * можно удалять.
 */
async function mergeCartItems(fromCartId: number, toCartId: number) {
  const fromItems = await db.query.cartItems.findMany({
    where: eq(cartItems.cartId, fromCartId),
  });
  for (const it of fromItems) {
    const existing = await db.query.cartItems.findFirst({
      where: and(
        eq(cartItems.cartId, toCartId),
        eq(cartItems.productId, it.productId)
      ),
    });
    if (existing) {
      await db
        .update(cartItems)
        .set({ qty: existing.qty + it.qty })
        .where(eq(cartItems.id, existing.id));
      await db.delete(cartItems).where(eq(cartItems.id, it.id));
    } else {
      await db
        .update(cartItems)
        .set({ cartId: toCartId })
        .where(eq(cartItems.id, it.id));
    }
  }
}

/**
 * Находит/создаёт корзину пользователя. Ключевая идея персистентности: у
 * залогиненного корзина несёт ОБА ключа — userId И sessionId. Тогда:
 *   • гость добавил товары и залогинился → гостевая корзина (по sessionId)
 *     сливается в корзину аккаунта (а не теряется);
 *   • юзера выкинуло с аккаунта (токен истёк) → он снова «гость» с тем же
 *     sessionId, и та же корзина находится по sessionId (а не сбрасывается).
 * Кука session_id живёт всегда (см. setSessionCookie), и для залогиненных тоже.
 */
async function getOrCreateCart(userId: string | null, sessionId: string) {
  // Гость — корзина по sessionId.
  if (!userId) {
    let cart = await db.query.carts.findFirst({
      where: eq(carts.sessionId, sessionId),
    });
    if (!cart) {
      [cart] = await db.insert(carts).values({ sessionId }).returning();
    }
    return cart;
  }

  // Залогинен. Сводим корзину аккаунта и гостевую (если есть) в одну строку.
  let userCart = await db.query.carts.findFirst({
    where: eq(carts.userId, userId),
  });
  const sessionCart = await db.query.carts.findFirst({
    where: eq(carts.sessionId, sessionId),
  });

  // Нет корзины аккаунта, но есть гостевая → «присваиваем» её юзеру
  // (оставляя sessionId — чтобы пережить будущий разлогин).
  if (!userCart && sessionCart) {
    [userCart] = await db
      .update(carts)
      .set({ userId })
      .where(eq(carts.id, sessionCart.id))
      .returning();
    return userCart!;
  }

  // Совсем нет корзины → создаём сразу с обоими ключами.
  if (!userCart) {
    const [created] = await db
      .insert(carts)
      .values({ userId, sessionId })
      .returning();
    return created;
  }

  // Корзина аккаунта есть. Если отдельная гостевая — сливаем её и удаляем.
  if (sessionCart && sessionCart.id !== userCart.id) {
    await mergeCartItems(sessionCart.id, userCart.id);
    if (!userCart.promoCode && sessionCart.promoCode) {
      await db
        .update(carts)
        .set({ promoCode: sessionCart.promoCode })
        .where(eq(carts.id, userCart.id));
    }
    await db.delete(carts).where(eq(carts.id, sessionCart.id));
  }

  // Гарантируем, что корзина аккаунта несёт текущий sessionId (для разлогина).
  if (userCart.sessionId !== sessionId) {
    [userCart] = await db
      .update(carts)
      .set({ sessionId })
      .where(eq(carts.id, userCart.id))
      .returning();
  }

  return userCart;
}

/** Кука гостевой сессии — ставится всегда (в т.ч. залогиненным), 30 дней. */
function setSessionCookie(response: NextResponse, sessionId: string) {
  response.cookies.set("session_id", sessionId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
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

    // Куку ставим всегда — она якорь корзины и при логине, и после разлогина.
    setSessionCookie(response, sessionId);

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

    // sessionId нужен всегда (и залогиненным) — он якорь корзины для слияния
    // при логине и для сохранения после разлогина.
    if (!sessionId) {
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
      setSessionCookie(response, sessionId);
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
    setSessionCookie(response, sessionId);
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




