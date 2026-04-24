import axios from "axios";
import type { SupplierAdapter, SearchParams, SupplierItem } from "./adapter";

/**
 * Forum-Auto REST v2 adapter.
 * Docs: https://api.forum-auto.ru/docs/index.php
 *
 * Transport: GET https://api.forum-auto.ru/v2/<method>?login=...&pass=...&<args>
 * Response:  JSON. В ошибках отдаётся объект { error: { code, message } }, в
 *            успехе — массив записей.
 *
 * Используемый метод: listGoods(login, pass, art, cross, br, gid).
 * Поля ответа listGoods:
 *   gid          — ID товара в системе Forum-Auto
 *   brand        — бренд/производитель
 *   art          — артикул
 *   name         — наименование
 *   d_deliv      — дней доставки
 *   h_deliv      — часов доставки
 *   kr           — кратность заказа
 *   num          — остаток
 *   price        — цена
 *   whse         — код склада
 *   is_returnable — 0/1 возможен ли возврат
 *
 * Коды ошибок (errors.php):
 *   5  — превышен лимит запросов в минуту
 *   6  — превышен лимит запросов в сутки
 *   10 — неверный логин/пароль
 *   20 — товар не найден
 *   27 — товары не найдены
 */

interface ForumAutoGoodsItem {
  gid?: string | number;
  brand?: string;
  art?: string;
  name?: string;
  d_deliv?: number | string;
  h_deliv?: number | string;
  kr?: number | string;
  num?: number | string;
  price?: number | string;
  whse?: string;
  is_returnable?: number | string;
}

interface ForumAutoErrorResponse {
  error?: { code?: number; message?: string };
}

export class ForumAutoAdapter implements SupplierAdapter {
  private baseUrl: string;
  private login: string;
  private password: string;
  private cross: string;

  constructor() {
    this.baseUrl =
      process.env.FORUM_AUTO_API_URL || "https://api.forum-auto.ru";
    this.login = process.env.FORUM_AUTO_LOGIN || "";
    this.password = process.env.FORUM_AUTO_PASSWORD || "";
    this.cross = process.env.FORUM_AUTO_CROSS || "0";
  }

  async search(params: SearchParams): Promise<SupplierItem[]> {
    if (!this.login || !this.password) {
      console.warn("Forum-Auto: login/password not configured");
      return [];
    }

    if (!params.article) {
      console.warn("Forum-Auto: article is required, skipping search");
      return [];
    }

    try {
      const response = await axios.get<ForumAutoGoodsItem[] | ForumAutoErrorResponse>(
        `${this.baseUrl}/v2/listGoods`,
        {
          timeout: 10000,
          params: {
            login: this.login,
            pass: this.password,
            art: params.article,
            cross: this.cross,
            ...(params.brand ? { br: params.brand } : {}),
          },
        }
      );

      const data = response.data;

      if (!Array.isArray(data)) {
        const err = (data as ForumAutoErrorResponse)?.error;
        if (err) {
          // Коды 20/27 — товар не найден; это штатная ситуация, не шумим
          if (err.code !== 20 && err.code !== 27) {
            console.warn("Forum-Auto API returned error:", err);
          }
        }
        return [];
      }

      const items: SupplierItem[] = [];
      for (const row of data) {
        const stock = toInt(row.num);
        const price = toFloat(row.price);
        if (stock <= 0 || price <= 0) continue;

        const dDeliv = toInt(row.d_deliv);
        const hDeliv = toInt(row.h_deliv);
        const deliveryDays =
          dDeliv > 0
            ? dDeliv
            : hDeliv > 0
            ? Math.max(1, Math.ceil(hDeliv / 24))
            : null;

        items.push({
          article: String(row.art || params.article),
          brand: row.brand || params.brand || "",
          name: row.name || "",
          price,
          stock,
          supplier: `Forum-Auto (${row.whse || "склад"})`,
          supplierCode: "forum-auto",
          deliveryDays,
          raw: {
            gid: row.gid,
            whse: row.whse,
            kr: toInt(row.kr),
            d_deliv: dDeliv,
            h_deliv: hDeliv,
            is_returnable: toInt(row.is_returnable),
          },
        });
      }

      return items;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Forum-Auto API error:", {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data,
        });
      } else {
        console.error("Forum-Auto unexpected error:", error);
      }
      return [];
    }
  }
}

function toInt(v: unknown): number {
  if (typeof v === "number") return Math.trunc(v);
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toFloat(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

const forumAutoAdapter = new ForumAutoAdapter();

export default forumAutoAdapter;
