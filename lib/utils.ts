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
 * Фактический срок, который видит покупатель с учётом границы приёма заказов.
 * После 12:00 ЕКБ предложение «сегодня» становится предложением «завтра» и
 * должно сравниваться по цене наравне с исходным сроком в один день.
 */
export function getEffectiveDeliveryDays(
  days: number | null | undefined,
  hour = localHour()
): number | null {
  if (days == null) return null;
  if (days === 0 && hour >= SAME_DAY_CUTOFF_HOUR) return 1;
  return days;
}

/**
 * Срок доставки в днях → человекочитаемая строка без служебных сокращений.
 * 0 → «сегодня» (до 12:00 ЕКБ) / «завтра» (после), 1 → «завтра»,
 * иначе «N день/дня/дней», null → «уточняется».
 */
export function formatDeliveryDays(days: number | null | undefined): string {
  const effectiveDays = getEffectiveDeliveryDays(days);
  if (effectiveDays == null) return "уточняется";
  if (effectiveDays === 0) return "сегодня";
  if (effectiveDays === 1) return "завтра";

  const mod10 = effectiveDays % 10;
  const mod100 = effectiveDays % 100;
  const unit =
    mod10 === 1 && mod100 !== 11
      ? "день"
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? "дня"
        : "дней";

  return `${effectiveDays} ${unit}`;
}

/** Полная подпись срока для каталога, карточки товара и корзины. */
export function formatDeliveryLabel(days: number | null | undefined): string {
  return `Доставка ${formatDeliveryDays(days)}`;
}

/**
 * В текущем контракте поставщиков нулевой исходный срок означает складской
 * остаток в Екатеринбурге. Проверяем именно исходный срок: после дневной
 * отсечки доставка станет «завтра», но товар физически останется на местном
 * складе. Положительный остаток с любым другим сроком - это товар поставщика,
 * а не основание для зелёной метки «В наличии».
 */
export function isYekaterinburgStock(
  stock: number | null | undefined,
  deliveryDays: number | null | undefined
): boolean {
  return (stock ?? 0) > 0 && deliveryDays === 0;
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

/**
 * Безопасная ссылка (для историй/баннеров): разрешаем только http(s) или
 * относительный путь (начинается с «/»). Иначе null — защита от javascript:/data:.
 */
export function safeLinkUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return trimmed;
  return null;
}
