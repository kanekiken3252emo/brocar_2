import axios, { AxiosInstance } from "axios";
import type { SupplierAdapter, SearchParams, SupplierItem } from "./adapter";

/**
 * ShATE-M REST API adapter.
 * Docs: https://api-doc.shate-m.ru/
 *
 * Flow:
 *  1. POST /api/v1/auth/loginbyapikey  (x-www-form-urlencoded: apikey=...)
 *     → { access_token, expires_in: 3600 }
 *  2. GET  /api/v1/articles/search/{article}?include=trademark&TradeMarkNames=...
 *     → список articles с их id
 *  3. POST /api/v1/prices/search/with_article_info
 *     body: { articleId, agreementCode, deliveryAddressCode, includeAnalogs }
 *     → предложения (цена/остаток/склад/срок)
 *
 * Для цен обязательны agreementCode и deliveryAddressCode — их берут из
 * /api/v1/customer/agreements и /api/v1/delivery/addresses (ЛК ShATE-M).
 */

interface TokenCache {
  token: string;
  expiresAt: number;
}

interface ShateArticle {
  id: number;
  code: string;
  tradeMarkName?: string;
  name?: string;
}

interface ShateArticleSearchItem {
  article: ShateArticle;
  tradeMark?: { name?: string; country?: string };
}

interface ShatePriceOffer {
  id: string;
  price?: {
    value?: number;
    valueWithMargin?: number;
    currencyCode?: string;
  };
  quantity?: {
    available?: number;
    multiplicity?: number;
    minimum?: number;
  };
  locationCode?: string;
  deliveryDateTimes?: Array<{
    deliveryAddressCode: string;
    deliveryDateTime: string;
  }>;
}

interface ShatePriceResponseItem {
  article: ShateArticle;
  prices?: ShatePriceOffer[];
}

export interface ShateCharacteristic {
  key: string;
  value: string;
}

export interface ShateOriginal {
  code: string;
  tradeMarkName?: string;
}

export interface ShateArticleDetails {
  article: ShateArticle;
  extendedInfo?: {
    extendedDescription?: string;
    originals?: ShateOriginal[];
    characteristics?: ShateCharacteristic[];
  };
}

export interface ShateAnalogItem {
  article: ShateArticle;
  tradeMark?: { name?: string; country?: string };
}

export interface ShateContent {
  // contentId — длинный hex-хэш (~128 символов), не число.
  contentId: string;
  contentType?: string;
}

export interface ShateContentData {
  contentId: string;
  data: string;
  mimeType: string;
}

export class ShateMAdapter implements SupplierAdapter {
  private baseUrl: string;
  private apiKey: string;
  private agreementCode: string;
  private deliveryAddressCode: string;
  private tokenCache: TokenCache | null = null;
  private client: AxiosInstance;

  constructor() {
    this.baseUrl = process.env.SHATE_M_API_URL || "https://api.shate-m.ru";
    this.apiKey = process.env.SHATE_M_API_KEY || "";
    this.agreementCode = process.env.SHATE_M_AGREEMENT_CODE || "";
    this.deliveryAddressCode = process.env.SHATE_M_DELIVERY_ADDRESS_CODE || "";
    this.client = axios.create({ baseURL: this.baseUrl, timeout: 10000 });
  }

  /**
   * Найти articleId по коду + бренду.
   *
   * Логика выбора (от строгого к мягкому):
   *  1. Точный матч code+brand (нормализованный).
   *  2. Точный матч code без учёта бренда.
   *  3. Если по бренду пришёл ровно один уникальный articleId — берём его.
   *     Это даёт картинки в случае когда у поставщика артикул в другом формате,
   *     но это уникально тот же товар.
   *  4. null — иначе. Лучше плейсхолдер чем чужая картинка (AFRR010 вместо AFR1).
   */
  async findArticleId(code: string, brand?: string): Promise<number | null> {
    if (!this.apiKey) return null;
    const token = await this.getToken();
    if (!token) return null;

    try {
      const resp = await this.client.get<
        { article: ShateArticle }[] | { article: ShateArticle }
      >(`/api/v1/articles/search/${encodeURIComponent(code)}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: brand ? { TradeMarkNames: brand, include: "trademark" } : undefined,
      });

      const list = Array.isArray(resp.data) ? resp.data : resp.data ? [resp.data] : [];
      const targetCode = normalizeKey(code);

      // 1. Точный матч code+brand
      if (brand) {
        const b = brand.toLowerCase().trim();
        const match = list.find(
          (x) =>
            (x.article?.tradeMarkName || "").toLowerCase().trim() === b &&
            normalizeKey(x.article?.code) === targetCode
        );
        if (match) return match.article.id;
      }

      // 2. Точный матч code без бренда
      const exact = list.find(
        (x) => normalizeKey(x.article?.code) === targetCode
      );
      if (exact?.article?.id) return exact.article.id;

      // 3. Fallback: если по бренду пришёл ровно один уникальный articleId —
      //    значит у поставщика это однозначно один товар.
      if (brand) {
        const b = brand.toLowerCase().trim();
        const brandIds = new Set(
          list
            .filter(
              (x) =>
                (x.article?.tradeMarkName || "").toLowerCase().trim() === b &&
                typeof x.article?.id === "number"
            )
            .map((x) => x.article.id)
        );
        if (brandIds.size === 1) {
          return [...brandIds][0];
        }
      }

      return null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("ShATE-M findArticleId error:", error.response?.status);
      }
      return null;
    }
  }

  /**
   * Получить подробности по articleId: characteristics, originals, extendedDescription.
   */
  async getArticleDetails(
    articleId: number
  ): Promise<ShateArticleDetails | null> {
    const token = await this.getToken();
    if (!token) return null;

    try {
      const resp = await this.client.get<ShateArticleDetails>(
        `/api/v1/articles/${articleId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { include: "extended_info" },
        }
      );
      return resp.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("ShATE-M getArticleDetails error:", error.response?.status);
      }
      return null;
    }
  }

  /**
   * Получить список content-записей (картинки/3D) товара по articleId.
   * Возвращает массив с contentId и contentType — сами данные тащим отдельным
   * запросом через fetchContent().
   */
  async getArticleContents(articleId: number): Promise<ShateContent[]> {
    const token = await this.getToken();
    if (!token) return [];

    try {
      const resp = await this.client.get<{
        article?: ShateArticle;
        contents?: ShateContent[];
      }>(`/api/v1/articles/${articleId}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { include: "contents" },
      });
      return Array.isArray(resp.data?.contents) ? resp.data.contents : [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("ShATE-M getArticleContents error:", error.response?.status);
      }
      return [];
    }
  }

  /**
   * Скачать сам контент (картинку) по contentId + contentType.
   * ShATE-M возвращает data-URI: "data:image/webp;base64,...".
   *
   * Реальный формат body (дока в шатем.txt раздел 4.1 устарела):
   *  {
   *    ContentKeys: [ { ContentId, ContentType } ],
   *    WidthSize?, HeightSize?
   *  }
   * Ответ (массив): [{ id, value }], value содержит data-URI.
   */
  async fetchContent(
    contentId: string,
    contentType: string,
    width?: number,
    height?: number
  ): Promise<ShateContentData | null> {
    const token = await this.getToken();
    if (!token) return null;

    const body = {
      ContentKeys: [{ ContentId: contentId, ContentType: contentType }],
      ...(width ? { WidthSize: width } : {}),
      ...(height ? { HeightSize: height } : {}),
    };

    try {
      const resp = await this.client.post<
        Array<{ id?: string; value?: string }> | { id?: string; value?: string }
      >("/api/v1/contents/search", body, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = Array.isArray(resp.data) ? resp.data[0] : resp.data;
      if (!result?.value) return null;

      const dataUri = result.value;
      const match = dataUri.match(/^data:([^;]+);base64,/);
      const mimeType = match?.[1] || "image/webp";

      return {
        contentId: result.id ?? contentId,
        data: dataUri,
        mimeType,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("ShATE-M fetchContent error:", {
          status: error.response?.status,
          data: error.response?.data,
          sentBody: body,
        });
      } else {
        console.error("ShATE-M fetchContent unexpected error:", error);
      }
      return null;
    }
  }

  /**
   * Получить список аналогов по articleId (другие бренды, подходят как замена).
   */
  async getAnalogs(articleId: number): Promise<ShateAnalogItem[]> {
    const token = await this.getToken();
    if (!token) return [];

    try {
      const resp = await this.client.get<ShateAnalogItem[]>(
        `/api/v1/articles/${articleId}/analogs`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { include: "trademark" },
        }
      );
      return Array.isArray(resp.data) ? resp.data : [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("ShATE-M getAnalogs error:", error.response?.status);
      }
      return [];
    }
  }

  private async getToken(): Promise<string | null> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now + 60_000) {
      return this.tokenCache.token;
    }

    try {
      const body = new URLSearchParams({ apikey: this.apiKey }).toString();
      const resp = await this.client.post<{
        access_token: string;
        expires_in?: number;
      }>("/api/v1/auth/loginbyapikey", body, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const token = resp.data.access_token;
      const expiresIn = resp.data.expires_in ?? 3600;
      this.tokenCache = { token, expiresAt: now + expiresIn * 1000 };
      return token;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("ShATE-M auth error:", {
          status: error.response?.status,
          data: error.response?.data,
        });
      } else {
        console.error("ShATE-M auth unexpected error:", error);
      }
      return null;
    }
  }

  async search(params: SearchParams): Promise<SupplierItem[]> {
    if (!this.apiKey) {
      console.warn("ShATE-M API key not configured");
      return [];
    }

    if (!params.article) {
      console.warn("ShATE-M: article is required, skipping search");
      return [];
    }

    const token = await this.getToken();
    if (!token) return [];

    try {
      const articleSearch = encodeURIComponent(params.article);
      const articleResp = await this.client.get<
        ShateArticleSearchItem | ShateArticleSearchItem[]
      >(`/api/v1/articles/search/${articleSearch}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          include: "trademark",
          ...(params.brand ? { TradeMarkNames: params.brand } : {}),
        },
      });

      const data = articleResp.data;
      const allArticles: ShateArticleSearchItem[] = Array.isArray(data)
        ? data
        : data
        ? [data]
        : [];

      // ShATE-M ищет по подстроке: запрос `KE100 LFW/X` + TradeMarkNames=`XYG`
      // у них может вернуть товар `KE100` бренда MASUMA (clipsa), потому что
      // TradeMarkNames — это намёк, а не строгий фильтр. Дополнительно жёстко
      // фильтруем по бренду на нашей стороне (если бренд передан).
      const articles = params.brand
        ? allArticles.filter((a) => {
            const tm = (
              a.article?.tradeMarkName ||
              a.tradeMark?.name ||
              ""
            )
              .toLowerCase()
              .trim();
            return tm === params.brand!.toLowerCase().trim();
          })
        : allArticles;

      if (articles.length === 0) return [];

      if (!this.agreementCode || !this.deliveryAddressCode) {
        console.warn(
          "ShATE-M: SHATE_M_AGREEMENT_CODE или SHATE_M_DELIVERY_ADDRESS_CODE не заданы — цены получить невозможно"
        );
        return [];
      }

      const articleIds = articles
        .map((a) => a.article?.id)
        .filter((id): id is number => typeof id === "number");

      if (articleIds.length === 0) return [];

      const filterKeys = articleIds.map((articleId) => ({
        articleId,
        agreementCode: this.agreementCode,
        deliveryAddressCode: this.deliveryAddressCode,
        includeAnalogs: false,
      }));

      const priceResp = await this.client.post<ShatePriceResponseItem[]>(
        "/api/v1/prices/search/with_article_info",
        filterKeys,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const priceItems = Array.isArray(priceResp.data) ? priceResp.data : [];
      return this.mapPriceItems(priceItems, {
        fallbackArticle: params.article,
        fallbackBrand: params.brand,
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("ShATE-M API error:", {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data,
        });
      } else {
        console.error("ShATE-M unexpected error:", error);
      }
      return [];
    }
  }

  /**
   * Получить офферы по конкретному articleId + аналоги одним запросом.
   * Используется на странице товара для отображения «Аналогов искомого бренда»
   * с ценами, остатками и складами.
   */
  async searchWithAnalogsById(articleId: number): Promise<SupplierItem[]> {
    if (!this.apiKey) return [];
    if (!this.agreementCode || !this.deliveryAddressCode) {
      console.warn(
        "ShATE-M: agreement/delivery не заданы — аналоги с ценами не получить"
      );
      return [];
    }

    const token = await this.getToken();
    if (!token) return [];

    try {
      const priceResp = await this.client.post<ShatePriceResponseItem[]>(
        "/api/v1/prices/search/with_article_info",
        [
          {
            articleId,
            agreementCode: this.agreementCode,
            deliveryAddressCode: this.deliveryAddressCode,
            includeAnalogs: true,
          },
        ],
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const priceItems = Array.isArray(priceResp.data) ? priceResp.data : [];
      return this.mapPriceItems(priceItems, {});
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("ShATE-M searchWithAnalogsById error:", {
          status: error.response?.status,
          message: error.message,
        });
      } else {
        console.error("ShATE-M searchWithAnalogsById unexpected error:", error);
      }
      return [];
    }
  }

  /**
   * Маппинг массива PriceResponseItem из ShATE-M → плоский список SupplierItem.
   */
  private mapPriceItems(
    items: ShatePriceResponseItem[],
    fallbacks: { fallbackArticle?: string; fallbackBrand?: string }
  ): SupplierItem[] {
    const results: SupplierItem[] = [];
    for (const p of items) {
      for (const offer of p.prices || []) {
        const avail = offer.quantity?.available ?? 0;
        if (avail <= 0) continue;

        // Базой для НАШЕЙ наценки берём ЗАКУПОЧНУЮ цену (value), а не
        // valueWithMargin: последняя уже включает маржу ШАТЕ-М, и наша наценка
        // поверх неё давала двойную накрутку (закупка 707 → на сайте 1401
        // вместо корректных ~1004 = 707 × ступенчатая наценка).
        const priceValue =
          offer.price?.value ?? offer.price?.valueWithMargin ?? 0;

        const deliveryDate = offer.deliveryDateTimes?.[0]?.deliveryDateTime;
        const deliveryDays = deliveryDate
          ? Math.max(
              0,
              Math.ceil(
                (new Date(deliveryDate).getTime() - Date.now()) / 86_400_000
              )
            )
          : null;

        results.push({
          article: p.article?.code || fallbacks.fallbackArticle || "",
          brand: p.article?.tradeMarkName || fallbacks.fallbackBrand || "",
          name: p.article?.name || "",
          price: Number(priceValue) || 0,
          stock: avail,
          supplier: `ShATE-M (${offer.locationCode || "склад"})`,
          supplierCode: "shate-m",
          deliveryDays,
          raw: {
            articleId: p.article?.id,
            priceId: offer.id,
            currencyCode: offer.price?.currencyCode,
            multiplicity: offer.quantity?.multiplicity,
            minimum: offer.quantity?.minimum,
            locationCode: offer.locationCode,
            deliveryDateTime: deliveryDate,
          },
        });
      }
    }
    return results;
  }
}

/**
 * Сравнение артикулов «по сути»: убираем все небуквенно-цифровые символы и
 * регистр. AFR-1 / afr 1 / AFR1 — один и тот же артикул. AFRR010 — другой.
 */
function normalizeKey(value: string | undefined | null): string {
  if (!value) return "";
  return value.replace(/[^a-z0-9]+/gi, "").toLowerCase();
}

const shateMAdapter = new ShateMAdapter();

export default shateMAdapter;
