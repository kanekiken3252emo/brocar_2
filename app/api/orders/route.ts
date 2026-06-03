import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { carts, orders, orderItems, profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { sendOrderNotification } from "@/lib/email";

/**
 * Создаёт заказ из корзины текущего пользователя.
 * Возвращает { orderId } — дальше фронт вызывает /api/payments/create.
 *
 * Требует авторизации: orders.user_id обязателен (NOT NULL).
 */
export async function POST() {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Для оформления заказа нужно войти в аккаунт" },
        { status: 401 }
      );
    }

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

    // Считаем сумму на сервере (не доверяем клиенту).
    // Округляем КАЖДУЮ позицию до копеек и суммируем — так сумма заказа
    // гарантированно совпадёт с суммой позиций чека (требование 54-ФЗ/ЮKassa).
    const total = cart.items.reduce((sum, item) => {
      const line = Number(
        (parseFloat(item.product.ourPrice) * item.qty).toFixed(2)
      );
      return sum + line;
    }, 0);

    // Создаём заказ
    const [order] = await db
      .insert(orders)
      .values({
        userId: user.id,
        status: "pending",
        total: total.toFixed(2),
      })
      .returning();

    // Переносим позиции корзины в позиции заказа (фиксируем цену на момент заказа)
    await db.insert(orderItems).values(
      cart.items.map((item) => ({
        orderId: order.id,
        productId: item.productId,
        name: item.product.name,
        article: item.product.article,
        brand: item.product.brand,
        qty: item.qty,
        price: item.product.ourPrice,
      }))
    );

    // Корзину НЕ очищаем здесь — иначе при неудачной оплате покупатель
    // останется с пустой корзиной и не сможет повторить. Чистим её в вебхуке
    // после успешной оплаты (status = paid).

    // Уведомление магазину на почту. Сбой отправки не должен ломать заказ —
    // заказ уже создан, поэтому ошибки письма только логируем.
    try {
      const profile = await db.query.profiles.findFirst({
        where: eq(profiles.id, user.id),
      });

      await sendOrderNotification({
        orderId: order.id,
        total,
        customerEmail: user.email ?? profile?.email ?? "—",
        customerName: profile?.fullName,
        customerPhone: profile?.phone,
        contactEmail: profile?.contactEmail,
        telegram: profile?.telegram,
        whatsapp: profile?.whatsapp,
        vk: profile?.vk,
        maxMessenger: profile?.maxMessenger,
        items: cart.items.map((item) => ({
          name: item.product.name,
          article: item.product.article,
          brand: item.product.brand,
          qty: item.qty,
          price: item.product.ourPrice,
        })),
      });
    } catch (mailError) {
      console.error("Order notification email failed:", mailError);
    }

    return NextResponse.json({ orderId: order.id, total });
  } catch (error) {
    console.error("Order creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}