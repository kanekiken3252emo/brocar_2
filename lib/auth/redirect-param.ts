/**
 * Параметр ?redirect=… на страницах входа/регистрации: куда вернуть после
 * успеха (оформление заказа, каталог по VIN). Только относительные пути на
 * нашем домене — «//evil.com» и абсолютные URL отбрасываем (open redirect).
 * Клиентские страницы; читается из window после монтирования.
 */
export function safeRedirectPath(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "";
}

export function readRedirectParam(): string {
  if (typeof window === "undefined") return "";
  return safeRedirectPath(
    new URLSearchParams(window.location.search).get("redirect")
  );
}

/** Ссылка на другую auth-страницу с сохранением redirect. */
export function withRedirect(path: string, redirect: string): string {
  return redirect ? `${path}?redirect=${encodeURIComponent(redirect)}` : path;
}
