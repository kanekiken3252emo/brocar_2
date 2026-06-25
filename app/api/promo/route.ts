import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { carts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { validatePromo, discountAmount, normalizePromoCode } from "@/lib/promo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Находит корзину текущего пользователя/сессии вместе с позициями. */
async function findCart() {
  const user = await getUser();
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;

  if (user) {
    return db.query.carts.findFirst({
      where: eq(carts.userId, user.id),
      with: { items: { with: { product: true } } },
    });
  }
  if (sessionId) {
    return db.query.carts.findFirst({
      where: eq(carts.sessionId, sessionId),
      with: { items: { with: { product: true } } },
    });
  }
  return null;
}

function cartSubtotal(cart: NonNullable<Awaited<ReturnType<typeof findCart>>>) {
  return Number(
    cart.items
      .reduce(
        (sum, it) => sum + Number((parseFloat(it.product.ourPrice) * it.qty).toFixed(2)),
        0
      )
      .toFixed(2)
  );
}

/** Применить промокод к корзине. Тело: { code }. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const code = normalizePromoCode(body?.code);
    if (!code) {
      return NextResponse.json({ ok: false, error: "Введите промокод" });
    }

    const cart = await findCart();
    if (!cart || cart.items.length === 0) {
      return NextResponse.json({ ok: false, error: "Корзина пуста" });
    }

    const check = await validatePromo(code);
    if (!check.ok) {
      return NextResponse.json({ ok: false, error: check.reason });
    }

    const subtotal = cartSubtotal(cart);
    const amount = discountAmount(subtotal, check.promo.discountPct);

    // Сохраняем код при корзине (серверно) — переживёт переход к оформлению.
    await db
      .update(carts)
      .set({ promoCode: check.promo.code })
      .where(eq(carts.id, cart.id));

    return NextResponse.json({
      ok: true,
      promo: {
        code: check.promo.code,
        discountPct: check.promo.discountPct,
        discountAmount: amount,
      },
      subtotal,
      total: Number((subtotal - amount).toFixed(2)),
    });
  } catch (error) {
    console.error("Promo apply error:", error);
    return NextResponse.json(
      { ok: false, error: "Не удалось применить промокод" },
      { status: 500 }
    );
  }
}

/** Снять промокод с корзины. */
export async function DELETE() {
  try {
    const cart = await findCart();
    if (cart) {
      await db
        .update(carts)
        .set({ promoCode: null })
        .where(eq(carts.id, cart.id));
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Promo remove error:", error);
    return NextResponse.json(
      { ok: false, error: "Не удалось снять промокод" },
      { status: 500 }
    );
  }
}
