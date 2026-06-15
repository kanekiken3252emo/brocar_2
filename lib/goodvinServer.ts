import axios, { AxiosInstance } from "axios";
import type {
  GoodvinCatalog,
  GoodvinCarInfo,
  GoodvinGroup,
  GoodvinParts,
} from "@/types/goodvin";

/**
 * Серверный клиент Catalogs API GoodVin (api.goodvin.net/v1).
 *
 * ВАЖНО: используется ТОЛЬКО на сервере (в /app/api/goodvin/*). Ключ — секрет,
 * в браузер его отдавать нельзя. Авторизация — заголовок `Authorization: <ключ>`
 * (ровно ключ, без "Bearer" — так делает их open-source клиент pc-client-slim).
 *
 * Доступ к API дополнительно закрыт белым списком IP на стороне GoodVin:
 * запросы должны идти с IP боевого сервера. С чужого IP API отвечает
 * 403 {"errorCode":1003,"message":"IP ... not allowed"} — это про IP, не про ключ.
 */

const GOODVIN_API_URL =
  process.env.GOODVIN_API_URL || "https://api.goodvin.net/v1";

// Один и тот же ключ используется и для виджета (data-key), и для API.
const GOODVIN_API_KEY =
  process.env.GOODVIN_API_KEY ||
  process.env.NEXT_PUBLIC_GOODVIN_KEY ||
  "TWS-74EE104F-A08B-45B6-8995-497F5361AD67";

const DEFAULT_LANG = "ru";

let client: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (client) return client;
  client = axios.create({
    baseURL: GOODVIN_API_URL,
    timeout: 30000,
    headers: {
      Authorization: GOODVIN_API_KEY,
      "User-Agent": "BroCar/1.0",
    },
  });
  return client;
}

async function get<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  lang: string = DEFAULT_LANG
): Promise<T> {
  const clean: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") clean[k] = v;
  }
  const res = await getClient().get<T>(path, {
    params: clean,
    headers: { "Accept-Language": lang },
  });
  return res.data;
}

export const goodvin = {
  /** Список доступных каталогов. Используется для диагностики доступа. */
  getCatalogs: (lang?: string) => get<GoodvinCatalog[]>("/catalogs/", {}, lang),

  /** Поиск авто по VIN или FRAME. q — сам VIN/Frame. */
  carInfo: (q: string, catalogs?: string, lang?: string) =>
    get<GoodvinCarInfo[]>("/car/info/", { q, catalogs }, lang),

  /**
   * Дерево узлов. Пустой groupId — корневые группы. Спускаемся по groupId,
   * пока у узла hasParts !== true.
   */
  getGroups: (
    catalogId: string,
    opts: { carId: string; groupId?: string; criteria?: string },
    lang?: string
  ) =>
    get<GoodvinGroup[]>(
      `/catalogs/${encodeURIComponent(catalogId)}/groups2`,
      { carId: opts.carId, groupId: opts.groupId, criteria: opts.criteria },
      lang
    ),

  /** Детали узла (только для групп с hasParts: true). */
  getParts: (
    catalogId: string,
    opts: { carId: string; groupId: string; criteria?: string },
    lang?: string
  ) =>
    get<GoodvinParts>(
      `/catalogs/${encodeURIComponent(catalogId)}/parts2`,
      { carId: opts.carId, groupId: opts.groupId, criteria: opts.criteria },
      lang
    ),
};

export type GoodvinClient = typeof goodvin;
