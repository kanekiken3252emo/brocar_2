import { NextResponse } from "next/server";
import axios from "axios";

/**
 * Единый обработчик ошибок для роутов /api/goodvin/*.
 * Прокидывает статус и тело ошибки апстрима, отдельно подсвечивает
 * 403 по белому списку IP, чтобы причина была видна сразу.
 */
export function goodvinErrorResponse(error: unknown): NextResponse {
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
