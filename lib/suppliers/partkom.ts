import axios from "axios";
import type { SupplierAdapter, SearchParams, SupplierItem } from "./adapter";

/**
 * ПартКом (part-kom.ru) REST v4 adapter.
 * Docs: PDF «Web сервисы Партком v4 Сервис поиска» (docs/partkom/).
 *
 * Transport: GET https://ws.part-kom.ru/v4/search/offers
 * Auth:      HTTP Basic (login:password) — те же логин/пароль, что в ЛК.
 * ВАЖНО: доступ к веб-сервисам ограничен по IP. Разрешённые адреса
 * настраиваются в ЛК ПартКом («Кабинет → Веб-сервисы»). С другого IP
 * сервер ответит отказом — это штатно для локальной разработки.
 *
 * Параметры запроса:
 *   number           — артикул (обязательный)
 *   maker_id         — ИД производителя в системе ПартКом (необязательный)
 *   find_substitutes — 0 только искомый артикул (default) / 1 с аналогами
 *   store            — 1 только склады ПартКом / 0 все поставщики (default)
 *
 * Ответ — JSON-массив предложений. Используемые поля:
 *   number          — артикул
 *   maker / makerId — производитель
 *   description     — наименование
 *   price           — цена, руб
 *   quantity        — остаток
 *   minQuantity     — минимальная партия
 *   placement       — склад выписки (город)
 *   detailGroup     — Original / ReplacementOriginal / ReplacementNonOriginal
 *   expectedDays / expectedHours / expectedDate — срок поставки «От»
 *   guaranteedDays / guaranteedHours / guaranteedDate — срок «До»
 */

interface PartKomOffer {
  number?: string;
  maker?: string;
  makerId?: number | string;
  description?: string;
  price?: number | string;
  quantity?: number | string;
  minQuantity?: number | string;
  storehouse?: boolean | number;
  detailGroup?: string;
  expectedDate?: string;
  guaranteedDate?: string;
  expectedHours?: number | string;
  guaranteedHours?: number | string;
  expectedDays?: number | string;
  guaranteedDays?: number | string;
  placement?: string;
  placementId?: number | string;
  providerId?: number | string;
  providerDescription?: string;
  isStock?: number;
  partId?: number | string;
}

export class PartKomAdapter implements SupplierAdapter {
  private baseUrl: string;
  private login: string;
  private password: string;
  private findSubstitutes: string;
  private storeOnly: string;

  constructor() {
    this.baseUrl = process.env.PARTKOM_API_URL || "https://ws.part-kom.ru";
    this.login = process.env.PARTKOM_LOGIN || "";
    this.password = process.env.PARTKOM_PASSWORD || "";
    this.findSubstitutes = process.env.PARTKOM_FIND_SUBSTITUTES || "0";
    this.storeOnly = process.env.PARTKOM_STORE_ONLY || "0";
  }

  async search(params: SearchParams): Promise<SupplierItem[]> {
    if (!this.login || !this.password) {
      console.warn("PartKom: login/password not configured");
      return [];
    }

    if (!params.article) {
      console.warn("PartKom: article is required, skipping search");
      return [];
    }

    try {
      const response = await axios.get<PartKomOffer[]>(
        `${this.baseUrl}/v4/search/offers`,
        {
          timeout: 10000,
          auth: { username: this.login, password: this.password },
          params: {
            number: params.article,
            find_substitutes: this.findSubstitutes,
            store: this.storeOnly,
          },
        }
      );

      const data = response.data;
      if (!Array.isArray(data)) {
        console.warn("PartKom API returned non-array response:", data);
        return [];
      }

      // Фильтр по бренду, если он передан (мы не знаем maker_id ПартКома,
      // поэтому фильтруем ответ по названию производителя).
      const wantedBrand = normalizeBrand(params.brand);

      const items: SupplierItem[] = [];
      for (const row of data) {
        const stock = toInt(row.quantity);
        const price = toFloat(row.price);
        if (stock <= 0 || price <= 0) continue;

        if (wantedBrand) {
          const rowBrand = normalizeBrand(row.maker);
          if (
            rowBrand &&
            rowBrand !== wantedBrand &&
            !rowBrand.includes(wantedBrand) &&
            !wantedBrand.includes(rowBrand)
          ) {
            continue;
          }
        }

        items.push({
          article: String(row.number || params.article),
          brand: row.maker || params.brand || "",
          name: row.description || "",
          price,
          stock,
          supplier: `ПартКом (${row.placement || "склад"})`,
          supplierCode: "partkom",
          deliveryDays: resolveDeliveryDays(row),
          raw: {
            partId: row.partId,
            makerId: row.makerId,
            providerId: row.providerId,
            placementId: row.placementId,
            minQuantity: toInt(row.minQuantity),
            detailGroup: row.detailGroup,
            guaranteedDays: toInt(row.guaranteedDays),
          },
        });
      }

      return items;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // 401/403 — неверные креды либо IP не в белом списке ЛК ПартКом
        console.error("PartKom API error:", {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data,
        });
      } else {
        console.error("PartKom unexpected error:", error);
      }
      return [];
    }
  }
}

/**
 * Срок поставки «От» в днях. ПартКом отдаёт его в трёх видах в порядке
 * предпочтения: дни → часы → конкретная дата. 0 дней = «сегодня»
 * (UI это поддерживает через formatDeliveryDays).
 */
function resolveDeliveryDays(row: PartKomOffer): number | null {
  const days = toInt(row.expectedDays);
  if (days > 0) return days;

  const hours = toInt(row.expectedHours);
  if (hours > 0) return Math.floor(hours / 24);

  const date = parseDate(row.expectedDate);
  if (date) {
    const diff = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
    return Math.max(0, diff);
  }

  const gDays = toInt(row.guaranteedDays);
  if (gDays > 0) return gDays;

  return null;
}

function parseDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v.replace(" ", "T"));
  return Number.isFinite(d.getTime()) ? d : null;
}

function normalizeBrand(v: unknown): string {
  return typeof v === "string"
    ? v.toLowerCase().replace(/[^0-9a-zа-яё]/g, "")
    : "";
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

const partKomAdapter = new PartKomAdapter();

export default partKomAdapter;
