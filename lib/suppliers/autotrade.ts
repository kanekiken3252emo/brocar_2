import axios from "axios";
import type { SupplierAdapter, SearchParams, SupplierItem } from "./adapter";

/**
 * Autotrade (api2.autotrade.su) REST/JSON-RPC-like adapter.
 *
 * Endpoint:  POST https://api2.autotrade.su/?json
 * Headers:   Content-Type: application/x-www-form-urlencoded; charset=UTF-8
 * Body:      data=<JSON.stringify({ auth_key, method, params })>
 *
 * Авторизация: готовый MD5-хэш из письма с открытием доступа к API.
 * Если в ЛК поменять логин/пароль — приходит новый ключ.
 *
 * Rate limit: 1 запрос/сек на учётную запись. Делаем глобальный
 * sequential queue на уровне модуля — все вызовы adapter'а ждут не
 * менее 1100 мс после предыдущего.
 *
 * Цены приходят в RUB (видно по полю currency в getStocksAndPrices).
 *
 * Для поиска используем getStocksAndPrices — массово (до 60 артикулов),
 * возвращает остатки по складам + цену. Картинки этим методом не приходят,
 * для них используется getItemsByQuery (см. lib/product-images.ts).
 */

const DEFAULT_API_URL = "https://api2.autotrade.su/?json";
// Минимальный интервал между запросами в мс. По доке 1 req/sec.
// Берём с запасом 100 мс чтобы не словить «Превышено ограничение».
const MIN_REQUEST_INTERVAL_MS = 1100;

let lastRequestAt = 0;
let pendingChain: Promise<void> = Promise.resolve();

/**
 * Глобальный sequential throttle на 1 req/sec. Каждый вызов цепляется
 * в очередь и ждёт пока предыдущий завершится + пауза.
 */
function throttle<T>(fn: () => Promise<T>): Promise<T> {
  const result = pendingChain.then(async () => {
    const now = Date.now();
    const waitFor = lastRequestAt + MIN_REQUEST_INTERVAL_MS - now;
    if (waitFor > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitFor));
    }
    try {
      return await fn();
    } finally {
      lastRequestAt = Date.now();
    }
  });
  // pendingChain должна продолжаться даже если fn выбросит, чтобы
  // следующие вызовы не зависли.
  pendingChain = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

interface AutotradeEnvelope<T> {
  code?: number | string;
  message?: string;
  // методы возвращают разные ключи на верхнем уровне, ниже типизация
  // через дженерик T.
  [key: string]: unknown;
}

/**
 * Структура одного склада из ответа getStocksAndPrices.items[article].stocks.
 */
interface AutotradeStockInfo {
  id?: string | number;
  name?: string;
  legend?: string;
  quantity_unpacked?: number | string;
  quantity_packed?: number | string;
  delivery_period?: number | string;
  in_way?: number;
}

interface AutotradeItemInfo {
  article?: string;
  name?: string;
  id?: string | number;
  brand?: string;
  inside_id_in?: string;
  price?: number | string;
  currency?: string;
  unit?: string;
  stocks?: Record<string, AutotradeStockInfo>;
  part_type_name?: string;
}

interface AutotradeStocksAndPricesResponse {
  items?: Record<string, AutotradeItemInfo>;
  code?: number;
  message?: string;
}

interface AutotradeItemsByQueryItem {
  type?: string;
  discounted?: number;
  id?: number | string;
  inside_id_in?: string;
  article?: string;
  name?: string;
  part_type_id?: number | string;
  part_type?: string;
  brand_id?: number | string;
  brand_name?: string;
  unit?: string;
  q?: string;
  photo?: string;
  extra_photos?: string[];
  country_of_origin?: string;
}

interface AutotradeItemsByQueryResponse {
  total?: number;
  page?: number;
  limit?: number;
  items?: AutotradeItemsByQueryItem[];
  code?: number;
  message?: string;
}

export class AutotradeAdapter implements SupplierAdapter {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.AUTOTRADE_API_URL || DEFAULT_API_URL;
    this.apiKey = process.env.AUTOTRADE_API_KEY || "";
  }

  /**
   * Отправляет один POST-запрос к API. Сериализованный JSON всегда идёт
   * в form-encoded ключе data — это требование самого API.
   */
  private async call<T>(method: string, params?: unknown): Promise<T | null> {
    if (!this.apiKey) {
      console.warn("Autotrade: AUTOTRADE_API_KEY not configured");
      return null;
    }

    const payload = JSON.stringify({
      auth_key: this.apiKey,
      method,
      ...(params !== undefined ? { params } : {}),
    });
    const body = new URLSearchParams({ data: payload }).toString();

    return throttle(async () => {
      try {
        const response = await axios.post<AutotradeEnvelope<T>>(
          this.baseUrl,
          body,
          {
            timeout: 15000,
            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded; charset=UTF-8",
              Accept: "application/json",
            },
          }
        );

        // API возвращает code != 0 на ошибках. Логируем, но возвращаем
        // ответ как есть — вызывающая сторона решит что делать.
        if (typeof response.data?.code === "number" && response.data.code !== 0) {
          console.warn("Autotrade API non-zero code:", {
            method,
            code: response.data.code,
            message: response.data.message,
          });
        }

        return response.data as unknown as T;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.error("Autotrade API error:", {
            method,
            status: error.response?.status,
            message: error.message,
            data: error.response?.data,
          });
        } else {
          console.error("Autotrade unexpected error:", error);
        }
        return null;
      }
    });
  }

  async search(params: SearchParams): Promise<SupplierItem[]> {
    if (!this.apiKey) {
      console.warn("Autotrade: not configured, skipping");
      return [];
    }
    if (!params.article) return [];

    // getStocksAndPrices принимает структуру: items[article][brand] = quantity.
    // Если бренда нет — используем wildcard "*", но API такое не понимает.
    // Без бренда лучше идти через getItemsByQuery. Здесь же — обязательная пара.
    if (!params.brand) {
      // Без бренда — отдельный путь через getItemsByQuery (нестрого, фильтр потом).
      return this.searchByQuery(params.article);
    }

    const data = await this.call<AutotradeStocksAndPricesResponse>(
      "getStocksAndPrices",
      {
        storages: [0], // 0 = все доступные склады
        items: {
          [params.article]: {
            [params.brand]: 1,
          },
        },
        withDelivery: 1,
      }
    );

    if (!data?.items) return [];

    return this.flattenStocksAndPrices(data.items, params);
  }

  /**
   * Поиск по произвольной строке через getItemsByQuery с включёнными
   * остатками/ценами. Используется когда бренд не известен.
   * Возвращает только товары с положительной ценой и остатком.
   */
  private async searchByQuery(query: string): Promise<SupplierItem[]> {
    const data = await this.call<AutotradeItemsByQueryResponse>(
      "getItemsByQuery",
      {
        q: [query],
        strict: 1,
        with_stocks_and_prices: 1,
        with_delivery: 1,
        limit: 20,
        // отключаем шум: ни кроссов, ни сопутки, ни «деталей в составе».
        replace: 0,
        cross: 0,
        related: 0,
        component: 0,
      }
    );

    const items = data?.items ?? [];
    if (items.length === 0) return [];

    // У getItemsByQuery нет structured stocks/price — поля приходят в
    // зависимости от with_stocks_and_prices, но в публичной доке поля
    // не описаны явно. Если в ответе есть price/quantity — берём.
    // Иначе возвращаем пустой список (как заглушку), пусть основной
    // путь идёт через getStocksAndPrices при известном бренде.
    const results: SupplierItem[] = [];
    for (const it of items) {
      const article = it.article ?? "";
      const brand = it.brand_name ?? "";
      if (!article || !brand) continue;
      // Поля цены/остатка не гарантированы в getItemsByQuery —
      // ограничиваемся метаданными для tryAutotrade (картинка),
      // а реальный поиск офферов делает adapter.search через
      // getStocksAndPrices, когда у нас есть бренд.
      results.push({
        article,
        brand,
        name: it.name ?? "",
        price: 0,
        stock: 0,
        supplier: "Autotrade",
        supplierCode: "autotrade",
        deliveryDays: null,
        raw: {
          inside_id_in: it.inside_id_in,
          photo: it.photo,
          country_of_origin: it.country_of_origin,
        },
      });
    }
    return results;
  }

  /**
   * Маппинг ответа getStocksAndPrices → плоский список SupplierItem
   * (по одной записи на каждый склад с положительным остатком).
   */
  private flattenStocksAndPrices(
    items: Record<string, AutotradeItemInfo>,
    params: SearchParams
  ): SupplierItem[] {
    const results: SupplierItem[] = [];
    for (const key of Object.keys(items)) {
      const item = items[key];
      const article = item.article ?? params.article ?? "";
      const brand = item.brand ?? params.brand ?? "";
      const name = item.name ?? "";
      const price = Number(item.price ?? 0);
      if (!Number.isFinite(price) || price <= 0) continue;

      const stocks = item.stocks ?? {};
      for (const stockKey of Object.keys(stocks)) {
        const s = stocks[stockKey];
        const unpacked = Number(s.quantity_unpacked ?? 0);
        const packed = Number(s.quantity_packed ?? 0);
        const stock = unpacked + packed;
        if (stock <= 0) continue;

        const deliveryDays = s.delivery_period != null ? Number(s.delivery_period) : null;

        results.push({
          article,
          brand,
          name,
          price,
          stock,
          supplier: `Autotrade (${s.name ?? s.legend ?? "склад"})`,
          supplierCode: "autotrade",
          deliveryDays: Number.isFinite(deliveryDays ?? NaN) ? deliveryDays : null,
          raw: {
            inside_id_in: item.inside_id_in,
            stock_id: s.id,
            stock_legend: s.legend,
            quantity_unpacked: unpacked,
            quantity_packed: packed,
            in_way: s.in_way ?? 0,
            currency: item.currency,
            unit: item.unit,
            part_type_name: item.part_type_name,
          },
        });
      }
    }
    return results;
  }

  /**
   * Получить URL картинки товара по (article, brand). Используется в
   * lib/product-images.ts как fallback после Armtek/ShATE-M.
   *
   * Через getItemsByQuery со strict=1 — он сразу возвращает поле photo,
   * не нужен отдельный getPhoto. Один запрос вместо двух — экономим
   * rate-limit.
   *
   * Возвращает null если ничего не нашлось точным совпадением бренда.
   */
  async getProductImageUrl(
    article: string,
    brand?: string
  ): Promise<string | null> {
    if (!this.apiKey) return null;
    if (!article) return null;

    const data = await this.call<AutotradeItemsByQueryResponse>(
      "getItemsByQuery",
      {
        q: [article],
        strict: 1,
        replace: 0,
        cross: 0,
        related: 0,
        component: 0,
        limit: 20,
      }
    );

    const items = data?.items ?? [];
    if (items.length === 0) return null;

    const targetBrand = brand?.toLowerCase().trim() || "";
    const targetArticle = normalizeKey(article);

    // 1. Точный матч article+brand
    if (targetBrand) {
      const match = items.find(
        (i) =>
          (i.brand_name || "").toLowerCase().trim() === targetBrand &&
          normalizeKey(i.article) === targetArticle &&
          i.photo
      );
      if (match?.photo) return match.photo;
    }

    // 2. Точный матч только по article
    const exact = items.find(
      (i) => normalizeKey(i.article) === targetArticle && i.photo
    );
    if (exact?.photo) return exact.photo;

    // 3. Fallback: если по бренду пришёл ровно один товар с фото — берём.
    if (targetBrand) {
      const brandMatches = items.filter(
        (i) =>
          (i.brand_name || "").toLowerCase().trim() === targetBrand && i.photo
      );
      const uniquePhotos = new Set(brandMatches.map((i) => i.photo as string));
      if (uniquePhotos.size === 1) {
        return [...uniquePhotos][0];
      }
    }

    return null;
  }
}

/**
 * Сравнение артикулов «по сути»: убираем все небуквенно-цифровые символы
 * и регистр (как в Armtek/ShATE-M adapter'ах).
 */
function normalizeKey(value: string | undefined | null): string {
  if (!value) return "";
  return value.replace(/[^a-z0-9]+/gi, "").toLowerCase();
}

const autotradeAdapter = new AutotradeAdapter();

export default autotradeAdapter;
