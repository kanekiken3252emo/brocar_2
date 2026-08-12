import "server-only";
import { client } from "@/lib/db";

/**
 * «Скрытые» заказы: пользователь может убрать заказ из своего кабинета, но у
 * магазина (админка) он остаётся — это финансовая запись, физически не удаляем.
 *
 * Храним в отдельной key-таблице (user_id, order_id), а не колонкой в orders,
 * чтобы не трогать существующие запросы к заказам. Таблица создаётся сама
 * (CREATE TABLE IF NOT EXISTS) — отдельная миграция на проде не нужна.
 */

export async function ensureHiddenOrders(): Promise<void> {
  await client`
    CREATE TABLE IF NOT EXISTS hidden_orders (
      user_id uuid NOT NULL,
      order_id bigint NOT NULL,
      hidden_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, order_id)
    )`;
}

/** Пометить заказ скрытым у данного пользователя (идемпотентно). */
export async function hideOrder(userId: string, orderId: number): Promise<void> {
  await ensureHiddenOrders();
  await client`
    INSERT INTO hidden_orders (user_id, order_id)
    VALUES (${userId}, ${orderId})
    ON CONFLICT DO NOTHING`;
}

/** Множество id заказов, скрытых пользователем (пусто, если таблицы ещё нет). */
export async function getHiddenOrderIds(userId: string): Promise<Set<number>> {
  try {
    const rows = await client<{ order_id: number }[]>`
      SELECT order_id FROM hidden_orders WHERE user_id = ${userId}`;
    return new Set(rows.map((r) => Number(r.order_id)));
  } catch {
    return new Set(); // таблицы может ещё не быть
  }
}
