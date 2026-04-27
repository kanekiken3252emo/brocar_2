import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import armtekAdapter from "@/lib/suppliers/armtek";

/**
 * Debug endpoint для диагностики интеграции Armtek.
 *
 * GET /api/debug/armtek?art=W719/5&brand=MANN
 *
 * Возвращает:
 *   env         — какие переменные видит сервер (пароль маскируется)
 *   vkorgList   — getUserVkorgList: список доступных VKORG (валидация авторизации)
 *   userInfo    — getUserInfo: структура клиента (валидация VKORG, KUNNR)
 *   direct      — search: первые 3 записи + общее количество
 *   adapter     — то, что построил адаптер (первые 5 SupplierItem)
 */
export async function GET(request: NextRequest) {
  const art = request.nextUrl.searchParams.get("art") || "W719/5";
  const brand = request.nextUrl.searchParams.get("brand") || undefined;

  const baseUrl =
    process.env.ARMTEK_API_URL || "http://ws.armtek.ru/api";
  const login = process.env.ARMTEK_LOGIN || "";
  const password = process.env.ARMTEK_PASSWORD || "";
  const vkorg = process.env.ARMTEK_VKORG || "4000";
  const kunnrRg = process.env.ARMTEK_KUNNR_RG || "";

  const env = {
    ARMTEK_API_URL: baseUrl,
    ARMTEK_LOGIN: login ? `${login.slice(0, 4)}…${login.slice(-4)}` : "(пусто)",
    ARMTEK_PASSWORD: password ? `set (${password.length} chars)` : "(пусто)",
    ARMTEK_VKORG: vkorg,
    ARMTEK_KUNNR_RG: kunnrRg || "(пусто)",
  };

  const auth =
    login && password
      ? Buffer.from(`${login}:${password}`).toString("base64")
      : "";

  // 1. getUserVkorgList — проверяет, что логин/пароль валидны
  let vkorgList: unknown = null;
  let vkorgListError: string | null = null;
  if (auth) {
    try {
      const r = await axios.get(
        `${baseUrl}/ws_user/getUserVkorgList?format=json`,
        {
          timeout: 15000,
          headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
        }
      );
      vkorgList = r.data;
    } catch (e) {
      vkorgListError = describeError(e);
    }
  } else {
    vkorgListError = "login/password not configured";
  }

  // 2. getUserInfo — проверяет, что VKORG валидный, отдаёт KUNNR_RG-список
  let userInfo: unknown = null;
  let userInfoError: string | null = null;
  if (auth) {
    try {
      const body = new URLSearchParams({
        VKORG: vkorg,
        STRUCTURE: "1",
      }).toString();
      const r = await axios.post(
        `${baseUrl}/ws_user/getUserInfo?format=json`,
        body,
        {
          timeout: 15000,
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
        }
      );
      // RESP может быть тяжёлым (вся структура клиента), отсечём
      type UserInfoResponse = {
        STATUS?: number;
        MESSAGES?: unknown;
        RESP?: { STRUCTURE?: unknown[] };
      };
      const data = r.data as UserInfoResponse;
      userInfo = {
        STATUS: data?.STATUS,
        MESSAGES: data?.MESSAGES,
        STRUCTURE_COUNT: Array.isArray(data?.RESP?.STRUCTURE)
          ? data.RESP.STRUCTURE.length
          : 0,
        FIRST_STRUCTURE: Array.isArray(data?.RESP?.STRUCTURE)
          ? data.RESP.STRUCTURE[0]
          : null,
      };
    } catch (e) {
      userInfoError = describeError(e);
    }
  } else {
    userInfoError = "login/password not configured";
  }

  // 3. search — основной поиск
  let direct: unknown = null;
  let directError: string | null = null;
  if (auth && kunnrRg) {
    try {
      const body = new URLSearchParams({
        VKORG: vkorg,
        KUNNR_RG: kunnrRg,
        PIN: art,
        QUERY_TYPE: brand ? "2" : "1",
        ...(brand ? { BRAND: brand } : {}),
      }).toString();
      const r = await axios.post(
        `${baseUrl}/ws_search/search?format=json`,
        body,
        {
          timeout: 15000,
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
        }
      );
      type SearchResponse = {
        STATUS?: number;
        MESSAGES?: unknown;
        RESP?: unknown;
      };
      const data = r.data as SearchResponse;
      direct = {
        STATUS: data?.STATUS,
        MESSAGES: data?.MESSAGES,
        RESP_count: Array.isArray(data?.RESP) ? data.RESP.length : "(не массив)",
        RESP_first3: Array.isArray(data?.RESP) ? data.RESP.slice(0, 3) : data?.RESP,
      };
    } catch (e) {
      directError = describeError(e);
    }
  } else {
    directError = !auth ? "login/password not configured" : "KUNNR_RG not configured";
  }

  // 4. адаптер
  const adapterItems = await armtekAdapter
    .search({ article: art, brand })
    .catch((e) => ({ error: String(e) }));

  return NextResponse.json(
    {
      query: { art, brand: brand || "(не задан)" },
      env,
      vkorgList,
      vkorgListError,
      userInfo,
      userInfoError,
      direct,
      directError,
      adapter: Array.isArray(adapterItems)
        ? { count: adapterItems.length, items: adapterItems.slice(0, 5) }
        : adapterItems,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

function describeError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    return `${e.code || e.response?.status || ""} ${e.message}`.trim();
  }
  return String(e);
}
