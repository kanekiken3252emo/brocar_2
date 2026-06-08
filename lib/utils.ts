import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Currency formatter for Russian Rubles
 */
export function formatPrice(price: number | string): string {
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numPrice);
}

/**
 * Граница приёма заказов «на сегодня», час по екатеринбургскому времени
 * (ЕКБ = МСК+2). Заказ до 12:00 ЕКБ ещё успевает «сегодня», после —
 * переносится на «завтра».
 */
export const SAME_DAY_CUTOFF_HOUR = 12;

/**
 * Текущий час по Екатеринбургу (0–23). Часовой пояс фиксирован, поэтому
 * значение одинаково на сервере и на клиенте — без рассинхрона при гидрации.
 */
function localHour(): number {
  // % 24 — на части ICU-версий полночь форматируется как «24», а не «0».
  return (
    Number(
      new Intl.DateTimeFormat("ru-RU", {
        hour: "numeric",
        hour12: false,
        timeZone: "Asia/Yekaterinburg",
      }).format(new Date())
    ) % 24
  );
}

/**
 * Срок доставки в днях → человекочитаемая строка.
 * 0 → «сегодня» (до 12:00 ЕКБ) / «завтра» (после), 1 → «завтра»,
 * иначе «N дн.», null → «уточн.».
 */
export function formatDeliveryDays(days: number | null | undefined): string {
  if (days == null) return "уточн.";
  if (days === 0) {
    return localHour() < SAME_DAY_CUTOFF_HOUR ? "сегодня" : "завтра";
  }
  if (days === 1) return "завтра";
  return `${days} дн.`;
}

/**
 * Server-side fetch wrapper with timeout
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 10000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

/**
 * Generate session ID for anonymous carts
 */
export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Safe number parsing
 */
export function parseNumber(value: unknown, defaultValue = 0): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
}




