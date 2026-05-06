import axios from "axios";
import type { SupplierAdapter, SearchParams, SupplierItem } from "./adapter";

/**
 * Armtek REST API adapter.
 * Docs: http://ws.armtek.ru/?page=service&alias=search
 *
 * Авторизация: HTTP Basic (login = email от ЛК ЭТП, password = пароль от ЛК).
 * Транспорт: POST http://ws.armtek.ru/api/<service>/<method>?format=json
 * Тело: application/x-www-form-urlencoded.
 *
 * Ответ обёрнут: { STATUS, MESSAGES, RESP }
 *   - STATUS: HTTP-код
 *   - MESSAGES: массив { TYPE, TEXT }
 *   - RESP: тело (массив записей для search)
 *
 * Метод search входы:
 *   VKORG       — сбытовая организация (обяз., обычно 4000 для России)
 *   KUNNR_RG    — покупатель (обяз., из getUserInfo→RG_TAB→KUNNR)
 *   PIN         — артикул (обяз.)
 *   BRAND       — бренд (опц., но рекомендуется)
 *   QUERY_TYPE  — 1=без аналогов, 2=с аналогами (опц.)
 *
 * Поля ответа RESP[]:
 *   PIN, BRAND, NAME, ARTID, KEYZAK (код склада), RVALUE (остаток),
 *   RDPRF (кратность), MINBM (мин. кол-во), PRICE, WAERS (валюта),
 *   DLVDT (дата поставки YYYYMMDDHHIISS), WRNTDT (гарант. дата), ANALOG.
 */

interface ArmtekSearchItem {
  PIN?: string;
  BRAND?: string;
  NAME?: string;
  ARTID?: string;
  KEYZAK?: string;
  PARNR?: string;
  RVALUE?: string;
  RDPRF?: string;
  MINBM?: string;
  VENSL?: string;
  PRICE?: string;
  WAERS?: string;
  DLVDT?: string;
  WRNTDT?: string;
  ANALOG?: string;
}

interface ArmtekEnvelope<T> {
  STATUS?: number;
  MESSAGES?: Array<{ TYPE?: string; TEXT?: string; CODE?: string | number }>;
  RESP?: T;
}

export class ArmtekAdapter implements SupplierAdapter {
  private baseUrl: string;
  private login: string;
  private password: string;
  private vkorg: string;
  private kunnrRg: string;

  constructor() {
    this.baseUrl =
      process.env.ARMTEK_API_URL || "http://ws.armtek.ru/api";
    this.login = process.env.ARMTEK_LOGIN || "";
    this.password = process.env.ARMTEK_PASSWORD || "";
    this.vkorg = process.env.ARMTEK_VKORG || "4000";
    this.kunnrRg = process.env.ARMTEK_KUNNR_RG || "";
  }

  async search(params: SearchParams): Promise<SupplierItem[]> {
    if (!this.login || !this.password) {
      console.warn("Armtek: login/password not configured");
      return [];
    }
    if (!this.kunnrRg) {
      console.warn("Armtek: KUNNR_RG not configured");
      return [];
    }
    if (!params.article) {
      return [];
    }

    try {
      const body = new URLSearchParams({
        VKORG: this.vkorg,
        KUNNR_RG: this.kunnrRg,
        PIN: params.article,
        QUERY_TYPE: params.brand ? "2" : "1",
        ...(params.brand ? { BRAND: params.brand } : {}),
      }).toString();

      const auth = Buffer.from(
        `${this.login}:${this.password}`
      ).toString("base64");

      const response = await axios.post<ArmtekEnvelope<ArmtekSearchItem[]>>(
        `${this.baseUrl}/ws_search/search?format=json`,
        body,
        {
          timeout: 12000,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${auth}`,
            Accept: "application/json",
          },
        }
      );

      const env = response.data;
      if (env.STATUS && env.STATUS >= 400) {
        console.warn("Armtek API error:", {
          status: env.STATUS,
          messages: env.MESSAGES,
        });
        return [];
      }

      const rows = Array.isArray(env.RESP) ? env.RESP : [];
      const items: SupplierItem[] = [];

      for (const row of rows) {
        const stock = parseInt(row.RVALUE || "0", 10);
        const price = parseFloat(row.PRICE || "0");
        if (!Number.isFinite(stock) || stock <= 0) continue;
        if (!Number.isFinite(price) || price <= 0) continue;

        items.push({
          article: row.PIN || params.article,
          brand: row.BRAND || params.brand || "",
          name: row.NAME || "",
          price,
          stock,
          supplier: `Armtek (${row.KEYZAK || "склад"})`,
          supplierCode: "armtek",
          deliveryDays: deliveryDaysFromDlvdt(row.DLVDT),
          raw: {
            artid: row.ARTID,
            keyzak: row.KEYZAK,
            parnr: row.PARNR,
            rdprf: row.RDPRF,
            minbm: row.MINBM,
            vensl: row.VENSL,
            waers: row.WAERS,
            dlvdt: row.DLVDT,
            wrntdt: row.WRNTDT,
            analog: row.ANALOG,
          },
        });
      }

      return items;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Armtek API error:", {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data,
        });
      } else {
        console.error("Armtek unexpected error:", error);
      }
      return [];
    }
  }
}

/**
 * Парсит формат YYYYMMDDHHIISS → количество дней до этой даты.
 * Возвращает null, если формат битый.
 */
function deliveryDaysFromDlvdt(dlvdt?: string): number | null {
  if (!dlvdt || dlvdt.length < 8) return null;
  const y = parseInt(dlvdt.slice(0, 4), 10);
  const m = parseInt(dlvdt.slice(4, 6), 10);
  const d = parseInt(dlvdt.slice(6, 8), 10);
  if (!(y > 2020 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  const target = new Date(y, m - 1, d).getTime();
  const diff = Math.ceil((target - Date.now()) / 86_400_000);
  return Math.max(0, diff);
}

const armtekAdapter = new ArmtekAdapter();

export default armtekAdapter;
