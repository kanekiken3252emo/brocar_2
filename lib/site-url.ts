import { type NextRequest } from "next/server";

/**
 * Публичный базовый URL для редиректов из route-обработчиков.
 *
 * За обратным прокси (nginx) `request.url` показывает внутренний адрес контейнера
 * (например, http://0.0.0.0:3000) — браузер его не откроет. Поэтому берём
 * X-Forwarded-Host (его ставит прокси), а если его нет — домен из env.
 */
export function publicBaseUrl(request: NextRequest): string {
  const fwdHost = request.headers.get("x-forwarded-host");
  const host = request.headers.get("host") || "";
  const fwdProto = request.headers.get("x-forwarded-proto");

  // 1) Явный forwarded-host от прокси (продакшн).
  if (fwdHost && !fwdHost.startsWith("0.0.0.0")) {
    const proto = fwdProto || (fwdHost.includes("localhost") ? "http" : "https");
    return `${proto}://${fwdHost}`;
  }
  // 2) Локальная разработка без прокси.
  if (host.includes("localhost") || host.includes("127.0.0.1")) {
    return `http://${host}`;
  }
  // 3) Иначе (за прокси без forwarded-host, Host = 0.0.0.0 и т.п.) — домен из env.
  const domain = process.env.NEXT_PUBLIC_SITE_DOMAIN || "localhost:3000";
  return domain.startsWith("localhost") || domain.startsWith("127.")
    ? `http://${domain}`
    : `https://${domain}`;
}
