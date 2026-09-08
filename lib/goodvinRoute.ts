import { NextResponse } from "next/server";
import axios from "axios";
import { LaximoGuestLimitError } from "@/lib/laximo/guest-limit";

/**
 * Единый обработчик ошибок для роутов /api/goodvin/*.
 * Прокидывает статус и тело ошибки апстрима, отдельно подсвечивает
 * 403 по белому списку IP, чтобы причина была видна сразу.
 * Гостевой лимит — 429 с code, по нему клиент показывает приглашение войти.
 */
export function goodvinErrorResponse(error: unknown): NextResponse {
  if (error instanceof LaximoGuestLimitError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 429, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 502;
    const upstream = error.response?.data;
    const ipBlocked =
      status === 403 &&
      String(
        (upstream as { message?: string } | undefined)?.message ?? ""
      )
        .toLowerCase()
        .includes("ip");
    return NextResponse.json(
      {
        error: ipBlocked
          ? "IP сервера не в белом списке GoodVin"
          : "Ошибка запроса к GoodVin API",
        upstream: upstream ?? error.message,
      },
      { status }
    );
  }
  return NextResponse.json(
    { error: (error as Error).message || "Internal server error" },
    { status: 500 }
  );
}
