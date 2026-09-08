import "server-only";
import type { NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { client } from "@/lib/db";
import { laximoDailyBudget, type LiveCallGuard } from "./cache";

/**
 * Дневной лимит на ЖИВЫЕ определения автомобиля для гостей (без входа).
 *
 * Считаем только реальные платные вызовы Laximo (FindVehicleByVIN / Plate /
 * Frame / Wizard2) — повторные просмотры идут из кэша и в лимит не входят.
 * Залогиненные клиенты не ограничены вовсе (решение владельца, 26.08.2026):
 * каталог открыт всем, а лимит — только страховка от парсеров, которые
 * прикидываются браузером и обходят фильтр по User-Agent (lib/bot-ua.ts).
 *
 * Ключ — IP: куку сессии парсер сбрасывает бесплатно, IP — нет. Живой
 * человек за день вводит 1-3 машины; 30 — с запасом даже на офис за одним
 * NAT. Поднять/опустить: env LAXIMO_GUEST_VEHICLES_DAILY.
 */
const DEFAULT_GUEST_DAILY = 30;

export class LaximoGuestLimitError extends Error {
  readonly code = "GUEST_LIMIT";
  constructor() {
    super(
      "Лимит поиска для гостей на сегодня исчерпан. Войдите или зарегистрируйтесь — для клиентов ограничений нет."
    );
  }
}

function clientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

/** Счётчики прошлых дней никому не нужны — подчищаем изредка, чтобы таблица
 *  кэша не пухла (по строке на IP в сутки). created_at у счётчика = первый
 *  запрос дня (ON CONFLICT его не трогает), так что «старше 2 суток» — безопасно. */
async function pruneOldGuestCounters(): Promise<void> {
  if (Math.random() > 0.02) return;
  try {
    await client`
      DELETE FROM laximo_cache
      WHERE cache_key LIKE 'budget:guest:%'
        AND created_at < now() - interval '2 days'`;
  } catch {
    // некритично
  }
}

/**
 * Для гостя возвращает guard, который надо вызвать ПЕРЕД живым запросом к
 * Laximo (внутри compute кэша — чтобы попадания в кэш не тратили лимит).
 * Для залогиненного — undefined (без ограничений).
 */
export async function guestVehicleGuard(
  request: NextRequest
): Promise<LiveCallGuard | undefined> {
  const user = await getUser();
  if (user) return undefined;
  const ip = clientIp(request);
  const limit =
    parseInt(process.env.LAXIMO_GUEST_VEHICLES_DAILY || "", 10) ||
    DEFAULT_GUEST_DAILY;
  return async () => {
    void pruneOldGuestCounters();
    if (!(await laximoDailyBudget(`guest:${ip}`, limit))) {
      throw new LaximoGuestLimitError();
    }
  };
}
