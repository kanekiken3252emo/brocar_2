import { NextResponse } from "next/server";
import axios from "axios";
import { goodvin } from "@/lib/goodvinServer";

/**
 * Диагностика доступа к Catalogs API GoodVin.
 *
 * Дёргает /catalogs/ с серверным ключом и возвращает понятный результат:
 *   200  → доступ есть, в ответе число доступных каталогов (можно строить каталог);
 *   403  → ключ принят, но IP сервера не в белом списке GoodVin (нужно дожать у них);
 *   иное → прокидываем статус и тело ошибки, чтобы было видно причину.
 *
 * Открыть на проде: https://brocarparts.ru/api/goodvin/ping
 */
export async function GET() {
  try {
    const catalogs = await goodvin.getCatalogs();
    return NextResponse.json({
      ok: true,
      message: "GoodVin API доступен с этого сервера",
      catalogsCount: Array.isArray(catalogs) ? catalogs.length : 0,
      sample: Array.isArray(catalogs)
        ? catalogs.slice(0, 5).map((c) => ({ id: c.id, name: c.name }))
        : undefined,
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 502;
      const upstream = error.response?.data;
      const ipBlocked =
        status === 403 &&
        typeof upstream === "object" &&
        upstream !== null &&
        String((upstream as { message?: string }).message ?? "")
          .toLowerCase()
          .includes("ip");
      return NextResponse.json(
        {
          ok: false,
          status,
          hint: ipBlocked
            ? "Ключ принят, но IP этого сервера не в белом списке GoodVin. Передайте его IP в поддержку GoodVin для API api.goodvin.net."
            : "Запрос к GoodVin API не прошёл — см. upstream.",
          upstream: upstream ?? error.message,
        },
        { status: status === 403 ? 200 : status }
      );
    }
    return NextResponse.json(
      { ok: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
