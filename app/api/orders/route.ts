import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { carts, orders, orderItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { validatePromo, discountAmount } from "@/lib/promo";
import {
  isCartItemVerificationFresh,
  isCartItemVerificationNeeded,
  refreshCartOffers,
} from "@/lib/cart/verification";

/**
 * Создаёт заказ из корзины текущего пользователя.
 * Возвращает { orderId } — дальше фронт вызывает /api/payments/create.
 *
 * Требует авторизации: orders.user_id обязателен (NOT NULL).
 */
export async function POST(request: Request) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Для оформления заказа нужно войти в аккаунт" },
        { status: 401 }
      );
    }

    // Необязательный список выбранных позиций корзины (галочки в корзине). Если
    // передан — в заказ идут ТОЛЬКО эти строки; иначе (обратная совместимость) —
    // вся корзина.
    const body = await request.json().catch(() => null);
    const rawIds =
      body && Array.isArray(body.cartItemIds) ? body.cartItemIds : null;
    const wantedIds = rawIds
      ? new Set(
          rawIds.filter((n: unknown): n is number => typeof n === "number")
        )
      : null;

    // Находим корзину пользователя со всеми позициями
    let cart = await db.query.carts.findFirst({
      where: eq(carts.userId, user.id),
      with: {
        items: {
          with: { product: true },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      return NextResponse.json({ error: "Корзина пуста" }, { status: 400 });
    }

    // Позиции для заказа: выбранные (если пришёл список) или вся корзина.
    let selectedItems = wantedIds
      ? cart.items.filter((it) => wantedIds.has(it.id))
      : cart.items;

    if (selectedItems.length === 0) {
      return NextResponse.json(
        { error: "Не выбраны позиции для заказа" },
        { status: 400 }
      );
    }

    // Не ходим к поставщикам на каждое оформление: серверный результат живёт
    // ровно час. Если выбранная позиция просрочена, делаем одну сверку и заново
    // читаем только серверные данные перед созданием заказа.
    const verificationNeeded = await Promise.all(
      selectedItems.map(isCartItemVerificationNeeded)
    );
    const staleIds = selectedItems
      .filter((_, index) => verificationNeeded[index])
      .map((item) => item.id);
    if (staleIds.length > 0) {
      await refreshCartOffers(cart.id, staleIds);
      cart = await db.query.carts.findFirst({
        where: eq(carts.id, cart.id),
        with: { items: { with: { product: true } } },
      });
      if (!cart) {
        return NextResponse.json({ error: "Корзина не найдена" }, { status: 400 });
      }
      selectedItems = wantedIds
        ? cart.items.filter((it) => wantedIds.has(it.id))
        : cart.items;
    }

    if (selectedItems.some((item) => item.verificationStatus === "unavailable")) {
      return NextResponse.json(
        {
          error:
            "Одна из позиций больше недоступна. Вернитесь в корзину и удалите её.",
        },
        { status: 409 }
      );
    }
    if (
      selectedItems.some(
        (item) =>
          item.verificationStatus === "insufficient_stock" ||
          (item.availableStock != null && item.qty > item.availableStock) ||
          !isCartItemVerificationFresh(item.verifiedAt)
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Не удалось подтвердить условия одной из позиций. Вернитесь в корзину и повторите проверку.",
        },
        { status: 409 }
      );
    }

    // Считаем сумму на сервере (не доверяем клиенту).
    // Округляем КАЖДУЮ позицию до копеек и суммируем — так сумма заказа
    // гарантированно совпадёт с суммой позиций чека (требование 54-ФЗ/ЮKassa).
    const subtotal = Number(
      selectedItems
        .reduce((sum, item) => {
          // Цена позиции = СНИМОК строки корзины (item.price); легаси-строки без
          // снимка — текущая цена товара (фоллбэк).
          const unit =
            item.price != null
              ? parseFloat(item.price)
              : parseFloat(item.product.ourPrice);
          const line = Number((unit * item.qty).toFixed(2));
          return sum + line;
        }, 0)
        .toFixed(2)
    );

    // Промокод применяем СЕРВЕРНО из корзины (carts.promo_code) и заново
    // валидируем на момент заказа: код мог истечь/выключиться после применения.
    // Снимок скидки (код, %, ₽) фиксируем в заказ.
    let appliedPromo: string | null = null;
    let appliedPct: number | null = null;
    let discount = 0;
    if (cart.promoCode) {
      const check = await validatePromo(cart.promoCode);
      if (check.ok) {
        const amount = discountAmount(subtotal, check.promo.discountPct);
        if (amount > 0) {
          appliedPromo = check.promo.code;
          appliedPct = check.promo.discountPct;
          discount = amount;
        }
      }
    }

    const total = Number((subtotal - discount).toFixed(2));

    // Создаём заказ
    const [order] = await db
      .insert(orders)
      .values({
        userId: user.id,
        status: "pending",
        total: total.toFixed(2),
        promoCode: appliedPromo,
        discountPct: appliedPct != null ? appliedPct.toString() : null,
        discountAmount: discount.toFixed(2),
      })
      .returning();

    // Переносим позиции корзины в позиции заказа (фиксируем цену на момент заказа).
    // Поставщика и срок тоже переносим снимком: письмо магазину «ОПЛАЧЕН» строится
    // из order_items, и без них менеджер не видит, у кого и за сколько дней заказывать.
    await db.insert(orderItems).values(
      selectedItems.map((item) => ({
        orderId: order.id,
        productId: item.productId,
        name: item.product.name,
        article: item.product.article,
        brand: item.product.brand,
        qty: item.qty,
        price: item.price ?? item.product.ourPrice,
        supplier: item.supplier,
        deliveryDays: item.deliveryDays,
      }))
    );

    // Корзину НЕ очищаем здесь — иначе при неудачной оплате покупатель
    // останется с пустой корзиной и не сможет повторить. Чистим её в вебхуке
    // после успешной оплаты (status = paid).

    // Писем здесь НЕТ — намеренно. И магазину, и покупателю письмо уходит только
    // на УСПЕШНОЙ ОПЛАТЕ (см. lib/payments/settle.ts): раньше магазин получал
    // «Новый заказ» ещё до оплаты и не мог отличить оплаченные от брошенных.
    // Бонусом это убрало SMTP-запрос (до 15 с при недоступном сервере) из ответа
    // на нажатие «Оплатить» — кнопка больше не «думает».

    return NextResponse.json({ orderId: order.id, total });
  } catch (error) {
    console.error("Order creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
