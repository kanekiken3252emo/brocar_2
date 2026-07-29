import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { carts, orders, orderItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { validatePromo, discountAmount } from "@/lib/promo";

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
    const cart = await db.query.carts.findFirst({
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
    const selectedItems = wantedIds
      ? cart.items.filter((it) => wantedIds.has(it.id))
      : cart.items;

    if (selectedItems.length === 0) {
      return NextResponse.json(
        { error: "Не выбраны позиции для заказа" },
        { status: 400 }
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