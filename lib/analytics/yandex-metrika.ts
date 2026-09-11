import { getCookieConsent } from "@/components/cookie-banner";

export const YM_COUNTER_ID = 110334546;

export type YandexMetrikaGoal =
  | "cart_item_added"
  | "checkout_started"
  | "order_created"
  | "vin_request_submitted"
  | "part_request_submitted"
  | "phone_clicked"
  | "messenger_clicked";

export type YandexMetrikaGoalParams = {
  order_price?: number;
  currency?: "RUB";
};

export type YmFn = ((
  id: number,
  method: string,
  ...args: unknown[]
) => void) & {
  a?: unknown[];
  l?: number;
};

declare global {
  interface Window {
    ym?: YmFn;
  }
}

function canSend(): boolean {
  return (
    typeof window !== "undefined" &&
    getCookieConsent()?.analytics === true &&
    typeof window.ym === "function"
  );
}

/**
 * Отправляет только заранее заведённые цели Метрики. Персональные данные и
 * содержимое форм сюда не передаются. Если аналитические cookie запрещены,
 * событие намеренно не отправляется.
 */
export function reachYandexMetrikaGoal(
  goal: YandexMetrikaGoal,
  params?: YandexMetrikaGoalParams
): boolean {
  if (!canSend()) return false;

  try {
    window.ym?.(YM_COUNTER_ID, "reachGoal", goal, params ?? {});
    return true;
  } catch {
    return false;
  }
}

/**
 * Вариант для события непосредственно перед уходом на другой домен. Ждём
 * callback Метрики, но не задерживаем пользователя дольше timeoutMs.
 */
export function reachYandexMetrikaGoalBeforeNavigation(
  goal: YandexMetrikaGoal,
  params?: YandexMetrikaGoalParams,
  timeoutMs = 800
): Promise<boolean> {
  if (!canSend()) return Promise.resolve(false);

  return new Promise((resolve) => {
    let finished = false;
    const finish = (sent: boolean) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      resolve(sent);
    };
    const timer = window.setTimeout(() => finish(true), timeoutMs);

    try {
      window.ym?.(
        YM_COUNTER_ID,
        "reachGoal",
        goal,
        params ?? {},
        () => finish(true)
      );
    } catch {
      finish(false);
    }
  });
}
