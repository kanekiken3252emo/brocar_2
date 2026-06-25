import { db } from "@/lib/db";
import { promoCodes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Промокоды. Единый источник правды: и предпросмотр в корзине, и применение
 * скидки при создании заказа зовут отсюда — чтобы клиент и сервер считали
 * одинаково, а решение всегда принимал сервер.
 */

export interface PromoRow {
  id: number;
  code: string;
  discountPct: number;
  active: boolean;
  startsAt: Date | null;
  expiresAt: Date | null;
}

export type PromoCheck =
  | { ok: true; promo: PromoRow }
  | { ok: false; reason: string };

/** Канонический вид кода: без пробелов по краям, верхний регистр. */
export function normalizePromoCode(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toUpperCase() : "";
}

/**
 * Проверяет код: существует, активен, попадает в срок действия (now).
 * Возвращает строку с причиной отказа (для показа пользователю) или промо.
 */
export async function validatePromo(
  rawCode: string,
  now: Date = new Date()
): Promise<PromoCheck> {
  const code = normalizePromoCode(rawCode);
  if (!code) return { ok: false, reason: "Введите промокод" };

  const row = await db.query.promoCodes.findFirst({
    where: eq(promoCodes.code, code),
  });
  if (!row) return { ok: false, reason: "Промокод не найден" };

  if (!row.active) return { ok: false, reason: "Промокод отключён" };

  if (row.startsAt && now < row.startsAt)
    return { ok: false, reason: "Промокод ещё не действует" };

  if (row.expiresAt && now > row.expiresAt)
    return { ok: false, reason: "Срок действия промокода истёк" };

  const pct = Number(row.discountPct);
  if (!Number.isFinite(pct) || pct <= 0)
    return { ok: false, reason: "Промокод недействителен" };

  return {
    ok: true,
    promo: {
      id: row.id,
      code: row.code,
      // Клампим в [1..100] — защита от кривого значения в БД.
      discountPct: Math.min(100, Math.max(1, pct)),
      active: row.active,
      startsAt: row.startsAt,
      expiresAt: row.expiresAt,
    },
  };
}

/**
 * Сумма скидки в рублях от subtotal по проценту, округлённая до копеек.
 * Скидка не может превышать саму сумму.
 */
export function discountAmount(subtotal: number, pct: number): number {
  if (!Number.isFinite(subtotal) || subtotal <= 0) return 0;
  const raw = (subtotal * pct) / 100;
  const rounded = Number(raw.toFixed(2));
  return Math.min(rounded, Number(subtotal.toFixed(2)));
}

/** Округление до копейки. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface PromoLine {
  /** Цена за ЕДИНИЦУ со скидкой (2 знака). Именно она идёт в чек как amount. */
  unit: number;
  qty: number;
  /** unit * qty (2 знака). */
  lineTotal: number;
}

/**
 * Раскладывает процентную скидку ПОЗИЦИОННО — к цене за единицу, с округлением
 * до копейки на единицу. Нужно для чека 54-ФЗ: ЮKassa ждёт в amount цену за
 * единицу и проверяет, что Σ(amount*qty) == сумме платежа. Считаем тем же
 * методом и subtotal/total. pct=0 → без скидки. Никогда не бросает.
 */
export function applyPercentDiscount(
  items: { price: number; qty: number }[],
  pct: number
): { subtotal: number; discount: number; total: number; lines: PromoLine[] } {
  const safePct = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0;
  const f = (100 - safePct) / 100;
  let subtotal = 0;
  let total = 0;
  const lines = items.map((it) => {
    const price = Number.isFinite(it.price) ? it.price : 0;
    const qty = it.qty;
    const unit = round2(price * f);
    const lineTotal = round2(unit * qty);
    subtotal = round2(subtotal + round2(price * qty));
    total = round2(total + lineTotal);
    return { unit, qty, lineTotal };
  });
  return { subtotal, total, discount: round2(subtotal - total), lines };
}
