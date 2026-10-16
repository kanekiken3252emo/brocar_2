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

export const SAME_DAY_CUTOFF_HOUR = 12;
const YEKATERINBURG_TIME_ZONE = "Asia/Yekaterinburg";

export interface DeliveryPromiseContext {
  supplierCode?: string | null;
  /** Реальное внутреннее имя склада. Покупателю оно не показывается. */
  supplier?: string | null;
  /** Безопасный публичный идентификатор графика без имени физического склада. */
  sameDaySchedule?: SameDayScheduleId | null;
}

export type SameDayScheduleId =
  | "berg-ekb"
  | "armtek-ekb"
  | "rossko-main-ekb"
  | "rossko-yasnaya-ekb"
  | "shate-ekb"
  | "forum-ekt"
  | "partkom-7965";

interface YekaterinburgClock {
  dateKey: string;
  weekday: number;
  minutes: number;
}

const WEEKDAY_NUMBER: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function yekaterinburgClock(now: Date): YekaterinburgClock {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: YEKATERINBURG_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  return {
    dateKey: [get("year"), get("month"), get("day")].join("-"),
    weekday: WEEKDAY_NUMBER[get("weekday")] ?? 0,
    minutes: hour * 60 + minute,
  };
}

export function getYekaterinburgDateKey(now = new Date()): string {
  return yekaterinburgClock(now).dateKey;
}

function normalizedWarehouse(value: string | null | undefined): string {
  return (value || "").trim().toLocaleLowerCase("ru-RU");
}

/**
 * Сопоставляет только подтверждённые локальные склады. Для известных
 * поставщиков любой другой склад считается удалённым и не получает обещание
 * «сегодня», даже если внешний API временно вернул нулевой срок.
 */
export function getSameDayScheduleId(
  context: DeliveryPromiseContext
): SameDayScheduleId | null {
  const code = (context.supplierCode || "").toLowerCase();
  const warehouse = normalizedWarehouse(context.supplier);

  if (code === "berg") {
    return /berg ekb/.test(warehouse) || /^vega\s*1$/.test(warehouse)
      ? "berg-ekb"
      : null;
  }
  if (code === "armtek") return "armtek-ekb";
  if (code === "rossko") {
    if (/ясн/.test(warehouse)) return "rossko-yasnaya-ekb";
    return /екатеринбург/.test(warehouse) || /^vega\s*3$/.test(warehouse)
      ? "rossko-main-ekb"
      : null;
  }
  if (code === "shate-m") {
    return /shate-e01|\(e01\)|екатеринбург/.test(warehouse) ||
      /^vega\s*4$/.test(warehouse)
      ? "shate-ekb"
      : null;
  }
  if (code === "forum-auto") {
    return /\(ekt\)|екатеринбург/.test(warehouse) ||
      /^vega\s*5$/.test(warehouse)
      ? "forum-ekt"
      : null;
  }
  if (code === "partkom") {
    return /екатеринбург|7965/.test(warehouse) || /^vega\s*7$/.test(warehouse)
      ? "partkom-7965"
      : null;
  }
  return null;
}

const SCHEDULED_SUPPLIERS = new Set([
  "berg",
  "armtek",
  "rossko",
  "shate-m",
  "forum-auto",
  "partkom",
]);

/** Последняя минута приёма заказа «на сегодня» по дню недели ЕКБ. */
function sameDayCutoffMinutes(
  schedule: SameDayScheduleId,
  weekday: number
): number | null {
  if (weekday === 0) return null; // BroCar по воскресеньям закрыт.
  if (schedule === "berg-ekb") return weekday === 6 ? 12 * 60 : 15 * 60 + 30;
  if (schedule === "armtek-ekb") return 17 * 60;
  if (schedule === "rossko-main-ekb") return 16 * 60 + 10;
  if (schedule === "rossko-yasnaya-ekb") {
    // Последняя поставка, которая укладывается в часы работы BroCar.
    return weekday === 6 ? 14 * 60 + 10 : 18 * 60 + 10;
  }
  if (schedule === "shate-ekb") return weekday === 6 ? null : 12 * 60 + 30;
  if (schedule === "forum-ekt") return 13 * 60;
  if (schedule === "partkom-7965")
    return weekday === 6 ? 13 * 60 : 16 * 60 + 30;
  return null;
}

/**
 * Фактический срок, который видит покупатель с учётом границы приёма заказов.
 * После отсечки конкретного локального склада предложение «сегодня» становится
 * предложением «завтра» и сравнивается наравне с исходным сроком в один день.
 */
export function getEffectiveDeliveryDays(
  days: number | null | undefined,
  context: DeliveryPromiseContext = {},
  now = new Date()
): number | null {
  if (days == null) return null;
  if (days !== 0) return days;

  const clock = yekaterinburgClock(now);
  const schedule =
    context.sameDaySchedule !== undefined
      ? context.sameDaySchedule
      : getSameDayScheduleId(context);
  if (!schedule) {
    const code = (context.supplierCode || "").toLowerCase();
    // Известный поставщик, но не подтверждённый локальный склад.
    if (SCHEDULED_SUPPLIERS.has(code)) return 1;
    // Обратная совместимость для старых/неразмеченных источников.
    return clock.minutes < SAME_DAY_CUTOFF_HOUR * 60 ? 0 : 1;
  }

  const cutoff = sameDayCutoffMinutes(schedule, clock.weekday);
  if (cutoff == null || clock.minutes >= cutoff) return 1;
  return days;
}

/** Изменилась ли обещанная дата между двумя моментами (ночь или отсечка). */
export function didDeliveryPromiseChange(
  days: number | null | undefined,
  context: DeliveryPromiseContext,
  from: Date,
  to: Date
): boolean {
  if (getYekaterinburgDateKey(from) !== getYekaterinburgDateKey(to))
    return true;
  return (
    getEffectiveDeliveryDays(days, context, from) !==
    getEffectiveDeliveryDays(days, context, to)
  );
}

/**
 * Срок доставки в днях → человекочитаемая строка без служебных сокращений.
 * 0 → «сегодня» до отсечки локального склада / «завтра» после неё,
 * 1 → «завтра»,
 * иначе «N день/дня/дней», null → «уточняется».
 */
export function formatDeliveryDays(
  days: number | null | undefined,
  context: DeliveryPromiseContext = {},
  now = new Date()
): string {
  const effectiveDays = getEffectiveDeliveryDays(days, context, now);
  return formatEffectiveDeliveryDays(effectiveDays);
}

/** Форматирует уже зафиксированный эффективный срок без повторного пересчёта. */
export function formatEffectiveDeliveryDays(
  effectiveDays: number | null | undefined
): string {
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
export function formatDeliveryLabel(
  days: number | null | undefined,
  context: DeliveryPromiseContext = {},
  now = new Date()
): string {
  return "Доставка " + formatDeliveryDays(days, context, now);
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
