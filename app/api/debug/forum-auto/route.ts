import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import forumAutoAdapter from "@/lib/suppliers/forum-auto";

/**
 * Debug endpoint: проверяет доступность Forum-Auto API из окружения Vercel.
 *
 * GET /api/debug/forum-auto?art=W719/5&brand=MANN
 *
 * Возвращает:
 *   env         — какие переменные видны (пароль маскируется)
 *   direct      — что отдаёт сам Forum-Auto (сырой JSON от /v2/listGoods)
 *   adapter     — что адаптер превращает в SupplierItem[]
 *   clientInfo  — статус учётки (лимит, баланс)
 */
export async function GET(request: NextRequest) {
  const art = request.nextUrl.searchParams.get("art") || "W719/5";
  const brand = request.nextUrl.searchParams.get("brand") || undefined;

  const login = process.env.FORUM_AUTO_LOGIN || "";
  const password = process.env.FORUM_AUTO_PASSWORD || "";
  const baseUrl = process.env.FORUM_AUTO_API_URL || "https://api.forum-auto.ru";

  const env = {
    FORUM_AUTO_API_URL: baseUrl,
    FORUM_AUTO_LOGIN: login ? `${login.slice(0, 4)}…${login.slice(-3)}` : "(пусто)",
    FORUM_AUTO_PASSWORD: password ? `set (${password.length} chars)` : "(пусто)",
    FORUM_AUTO_CROSS: process.env.FORUM_AUTO_CROSS || "(пусто, по умолч. 0)",
  };

  let clientInfo: unknown = null;
  let clientInfoError: string | null = null;
  try {
    const r = await axios.get(`${baseUrl}/v2/clientInfo`, {
      timeout: 15000,
      params: { login, pass: password },
    });
    clientInfo = r.data;
  } catch (e) {
    clientInfoError = axios.isAxiosError(e)
      ? `${e.code || e.response?.status || ""} ${e.message}`
      : String(e);
  }

  let direct: unknown = null;
  let directError: string | null = null;
  try {
    const r = await axios.get(`${baseUrl}/v2/listGoods`, {
      timeout: 15000,
      params: {
        login,
        pass: password,
        art,
        cross: process.env.FORUM_AUTO_CROSS || "0",
        ...(brand ? { br: brand } : {}),
      },
    });
    direct = Array.isArray(r.data)
      ? { count: r.data.length, first3: r.data.slice(0, 3) }
      : r.data;
  } catch (e) {
    directError = axios.isAxiosError(e)
      ? `${e.code || e.response?.status || ""} ${e.message}`
      : String(e);
  }

  const adapterItems = await forumAutoAdapter.search({ article: art, brand }).catch(
    (e) => ({ error: String(e) })
  );

  return NextResponse.json(
    {
      query: { art, brand: brand || "(не задан)" },
      env,
      clientInfo,
      clientInfoError,
      direct,
      directError,
      adapter: Array.isArray(adapterItems)
        ? { count: adapterItems.length, items: adapterItems.slice(0, 5) }
        : adapterItems,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
