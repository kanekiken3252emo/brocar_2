// Каноничный бренд: схлопывает разные написания одного бренда (STELLOX/Stellox)
// и в живых ответах поставщиков, как и в импортированном каталоге.
import { canonicalBrand, brandKey } from "../brands/canonical.mjs";
import { brandFamilyId, familyDisplayName } from "../brands/families.mjs";
// Ремонт битых названий из живых ответов поставщиков (особенно Armtek):
// «KopfstГ tze» → «Kopfstütze», выбор чистого дубля вместо «Р С С Р».
import { repairSupplierName, nameScore, pickBetterName } from "./mojibake";

/**
 * Generic supplier item interface — одно предложение от одного склада одного поставщика
 */
export interface SupplierItem {
  article: string;
  brand?: string;
  name: string;
  price: number;
  stock: number;
  supplier: string;
  supplierCode?: string;
  deliveryDays?: number | null;
  /** Стабильный ID конкретного оффера/склада в системе поставщика. */
  sourceOfferId?: string;
  raw?: unknown;
}

export interface SupplierFulfillmentPart {
  /** Реальный поставщик и физический склад - только для внутреннего заказа. */
  supplier: string;
  stock: number;
  sourceOfferId?: string;
}

/**
 * Предложение в рамках товара (используется на фронте).
 * То же самое что SupplierItem + наценка (ourPrice).
 */
export interface SupplierOffer {
  supplier: string;
  supplierCode: string;
  price: number;
  ourPrice: number;
  stock: number;
  deliveryDays: number | null;
  sourceOfferId?: string;
  /** Разбивка объединённого публичного оффера по физическим складам. */
  fulfillment?: SupplierFulfillmentPart[];
}

/**
 * Товар, сгруппированный по article+brand, со списком предложений от разных поставщиков
 */
export interface SupplierGroup {
  article: string;
  brand: string;
  name: string;
  minPrice: number;
  maxPrice: number;
  totalStock: number;
  minDeliveryDays: number | null;
  offers: SupplierOffer[];
  /**
   * URL картинки из кэша product_images, если был обогащён сервером:
   *   string    — готовый URL, клиент засевает in-memory cache и рисует сразу
   *   undefined — не обогащено, клиент сам спросит /api/product-image
   *
   * Negative cache (image_url=null в БД) намеренно не пробрасываем,
   * чтобы старые «битые» записи не блокировали повторную подтяжку.
   * См. enrichGroupsWithImages в lib/product-images.ts.
   */
  imageUrl?: string;
}

/**
 * Search parameters for supplier adapters
 */
export interface SearchParams {
  article?: string;
  brand?: string;
  /** Подсказка конкретному адаптеру для разрешения неоднозначного артикула.
   *  В отличие от brand, не должна сужать общий поиск у остальных поставщиков. */
  preferredBrand?: string;
  /** Вернуть и ЗАМЕНИТЕЛИ других брендов (кроссы поставщика), а не только
   *  точный артикул. Поддерживают Rossko (блок crosses) и Berg (analogs=1). */
  withCrosses?: boolean;
}

/**
 * Supplier adapter interface
 */
export interface SupplierAdapter {
  search(params: SearchParams): Promise<SupplierItem[]>;
}

/**
 * Потолок «правдоподобной» розничной цены автозапчасти, ₽. Импорт прайс-листов
 * (в частности Армтек в «АЛЬТ-формате» со сдвигом колонок) иногда заносит в
 * numeric-колонку цены мусор: 13-значный баркод (→ цены в сотни млн–триллионы)
 * или спецзначение NaN (Postgres его допускает, NOT NULL проходит). Ни одна
 * реальная позиция магазина к этому потолку не приближается — поднимать его
 * стоит только если в каталоге появится действительно столь дорогой товар.
 */
export const MAX_PLAUSIBLE_PRICE = 50_000_000;

/**
 * Валидна ли финальная цена для показа и продажи: конечное положительное число
 * в пределах правдоподобного потолка. Отсекает NaN, ≤0 и баркод-мусор.
 *
 * Важно: NaN-цену не только нельзя показать (она сериализуется в JSON как null,
 * а `null.toLocaleString()` роняет рендер карточки и весь каталог), но Postgres
 * при `ORDER BY … DESC` сортирует NaN ВЫШЕ всех чисел — поэтому «безценовая»
 * позиция всплывала первой на странице «цена по убыванию». См. фильтры в
 * роутах каталога и formatPrice в карточках товара.
 */
export function isValidPrice(n: number): boolean {
  return Number.isFinite(n) && n > 0 && n < MAX_PLAUSIBLE_PRICE;
}

/**
 * Сортировка предложений внутри товара: «в наличии → быстрее → дешевле».
 *   1) сначала то, что в наличии (остаток > 0);
 *   2) затем по сроку доставки
 *      (быстрее — выше; «уточн.»/null — в конец);
 *   3) при равном сроке — по возрастанию цены.
 * Используется и в карточке товара, и в карточках поиска, чтобы порядок
 * был единым.
 */
export function compareOffers(a: SupplierOffer, b: SupplierOffer): number {
  const aInStock = a.stock > 0 ? 1 : 0;
  const bInStock = b.stock > 0 ? 1 : 0;
  if (aInStock !== bInStock) return bInStock - aInStock; // в наличии — выше

  const aDays = a.deliveryDays ?? Infinity;
  const bDays = b.deliveryDays ?? Infinity;
  if (aDays !== bDays) return aDays - bDays; // быстрее — выше

  return a.ourPrice - b.ourPrice; // при равном сроке дешевле — выше
}

function atomicOffers(offer: SupplierOffer): SupplierOffer[] {
  if (!offer.fulfillment?.length) return [offer];
  return offer.fulfillment.map((part) => ({
    ...offer,
    supplier: part.supplier,
    stock: part.stock,
    sourceOfferId: part.sourceOfferId,
    fulfillment: undefined,
  }));
}

/**
 * Убирает один и тот же физический оффер, повторно пришедший через поиск/
 * семейство брендов, а затем объединяет разные склады только когда покупателю
 * показываются одинаковые поставщик, розничная цена и срок.
 */
export function consolidateOffers(offers: SupplierOffer[]): SupplierOffer[] {
  const exact = new Map<string, SupplierOffer>();

  for (const offer of offers.flatMap(atomicOffers)) {
    const supplierCode = offer.supplierCode || "unknown";
    const exactKey = offer.sourceOfferId
      ? `${supplierCode}|id:${offer.sourceOfferId}`
      : `${supplierCode}|fallback:${offer.supplier}|${offer.price}|${offer.ourPrice}|${offer.deliveryDays ?? "null"}|${offer.stock}`;
    const previous = exact.get(exactKey);
    if (!previous) {
      exact.set(exactKey, offer);
      continue;
    }

    // Повтор одной записи не увеличивает остаток. Берём самый свежий/полный
    // вариант: максимальный остаток, при равенстве - меньшую цену и срок.
    const better =
      offer.stock > previous.stock ||
      (offer.stock === previous.stock && compareOffers(offer, previous) < 0)
        ? offer
        : previous;
    exact.set(exactKey, {
      ...better,
      stock: Math.max(offer.stock, previous.stock),
    });
  }

  const buckets = new Map<string, SupplierOffer>();
  for (const offer of exact.values()) {
    const key = `${offer.supplierCode}|${offer.ourPrice}|${offer.deliveryDays ?? "null"}`;
    const part: SupplierFulfillmentPart = {
      supplier: offer.supplier,
      stock: offer.stock,
      sourceOfferId: offer.sourceOfferId,
    };
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, { ...offer, fulfillment: undefined });
      continue;
    }
    if (!existing.fulfillment) {
      existing.fulfillment = [
        {
          supplier: existing.supplier,
          stock: existing.stock,
          sourceOfferId: existing.sourceOfferId,
        },
      ];
    }
    existing.stock += offer.stock;
    existing.price = Math.min(existing.price, offer.price);
    existing.fulfillment!.push(part);
    existing.sourceOfferId = undefined;
  }

  return Array.from(buckets.values()).sort(compareOffers);
}

/** Убирает внутренние ID поставщиков перед сериализацией в браузер. */
export function toPublicSupplierGroup(group: SupplierGroup): SupplierGroup {
  return {
    ...group,
    offers: group.offers.map((offer) => {
      const publicOffer = { ...offer };
      delete publicOffer.sourceOfferId;
      publicOffer.fulfillment = offer.fulfillment?.map((part) => {
        const publicPart = { ...part };
        delete publicPart.sourceOfferId;
        return publicPart;
      });
      return publicOffer;
    }),
  };
}

function recomputeGroup(group: SupplierGroup): SupplierGroup {
  group.offers = consolidateOffers(group.offers);
  const prices = group.offers.map((offer) => offer.ourPrice);
  group.minPrice = Math.min(...prices);
  group.maxPrice = Math.max(...prices);
  group.totalStock = group.offers.reduce((sum, offer) => sum + offer.stock, 0);
  const deliveries = group.offers
    .map((offer) => offer.deliveryDays)
    .filter((days): days is number => days != null);
  group.minDeliveryDays = deliveries.length ? Math.min(...deliveries) : null;
  return group;
}

/**
 * Сортировка ТОВАРОВ (групп) для блока аналогов:
 * «в наличии → быстрее → дешевле». В отличие от предложений одного товара,
 * здесь сначала показываем самые быстро доставляемые аналоги.
 */
export function compareGroupsByDelivery(
  a: SupplierGroup,
  b: SupplierGroup
): number {
  const aInStock = a.totalStock > 0 ? 1 : 0;
  const bInStock = b.totalStock > 0 ? 1 : 0;
  if (aInStock !== bInStock) return bInStock - aInStock; // в наличии — выше

  const aDays = a.minDeliveryDays ?? Infinity;
  const bDays = b.minDeliveryDays ?? Infinity;
  if (aDays !== bDays) return aDays - bDays; // быстрее — выше

  return a.minPrice - b.minPrice; // потом дешевле
}

/**
 * Нормализует артикул для сравнения/группировки: убирает пробелы, дефисы,
 * точки, слэши и приводит к верхнему регистру. Так «1 457 429 870» и
 * «1457429870» считаются одним артикулом (стандартная практика для автозапчастей).
 */
export function normalizeArticle(article: string): string {
  return (article || "").replace(/[^0-9A-Za-zА-Яа-я]/g, "").toUpperCase();
}

/**
 * Объединяет группы-дубли, у которых совпадает нормализованный артикул + бренд
 * (например один и тот же товар, пришедший с разным форматом артикула).
 * Складывает предложения, пересчитывает агрегаты, артикул отдаёт в чистом виде.
 */
export function dedupeGroups(groups: SupplierGroup[]): SupplierGroup[] {
  const map = new Map<string, SupplierGroup>();

  for (const g of groups) {
    const key = `${normalizeArticle(g.article)}|${brandKey(canonicalBrand(g.brand))}`;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        ...g,
        article: normalizeArticle(g.article),
        brand: canonicalBrand(g.brand),
        name: repairSupplierName(g.name),
        offers: [...g.offers],
      });
      continue;
    }

    existing.name = pickBetterName(existing.name, g.name);
    existing.offers.push(...g.offers);
    existing.totalStock += g.totalStock;
    existing.minPrice = Math.min(existing.minPrice, g.minPrice);
    existing.maxPrice = Math.max(existing.maxPrice, g.maxPrice);
    if (
      g.minDeliveryDays != null &&
      (existing.minDeliveryDays == null ||
        g.minDeliveryDays < existing.minDeliveryDays)
    ) {
      existing.minDeliveryDays = g.minDeliveryDays;
    }
    if (!existing.imageUrl && g.imageUrl) existing.imageUrl = g.imageUrl;
  }

  for (const g of map.values()) recomputeGroup(g);

  return Array.from(map.values()).sort((a, b) => a.minPrice - b.minPrice);
}

/**
 * Склейка «один артикул + один КОНЦЕРН = одна карточка» (решение владельца):
 * PSA / PEUGEOT/CITROEN / Citroen с одним артикулом — это один оригинал,
 * раздельные карточки тянули каждая свой кусок предложений и аналогов.
 * Предложения объединяются, агрегаты пересчитываются; ярлык и название — от
 * группы с бОльшим числом предложений (реальный ярлык → работают картинки).
 * Бренды вне таблицы семейств (аналоги SUFIX/Pilenga…) не трогаются.
 */
export function mergeFamilyGroups(groups: SupplierGroup[]): SupplierGroup[] {
  const byKey = new Map<string, { g: SupplierGroup; topOffers: number }>();
  const out: SupplierGroup[] = [];

  for (const g of groups) {
    const fam = brandFamilyId(g.brand);
    if (fam === null) {
      out.push(g);
      continue;
    }
    const key = `${normalizeArticle(g.article)}|fam${fam}`;
    // Принудительное имя семейства (просьба владельца: PSA-ярлыки на карточке
    // называются «Peugeot/Citroen») — применяется и к одиночным группам.
    const forcedName = familyDisplayName(g.brand);
    const existing = byKey.get(key);
    if (!existing) {
      const copy: SupplierGroup = { ...g, offers: [...g.offers] };
      if (forcedName) copy.brand = forcedName;
      byKey.set(key, { g: copy, topOffers: g.offers.length });
      out.push(copy);
      continue;
    }
    const ex = existing.g;
    // Ярлык/имя/картинка — от самой «толстой» составляющей (кроме
    // принудительного имени — оно не перетирается).
    if (g.offers.length > existing.topOffers) {
      if (!forcedName) ex.brand = g.brand;
      ex.name = pickBetterName(g.name, ex.name);
      if (g.imageUrl) ex.imageUrl = g.imageUrl;
      existing.topOffers = g.offers.length;
    } else {
      ex.name = pickBetterName(ex.name, g.name);
      if (!ex.imageUrl && g.imageUrl) ex.imageUrl = g.imageUrl;
    }
    ex.offers.push(...g.offers);
    ex.totalStock += g.totalStock;
    ex.minPrice = Math.min(ex.minPrice, g.minPrice);
    ex.maxPrice = Math.max(ex.maxPrice, g.maxPrice);
    if (
      g.minDeliveryDays != null &&
      (ex.minDeliveryDays == null || g.minDeliveryDays < ex.minDeliveryDays)
    ) {
      ex.minDeliveryDays = g.minDeliveryDays;
    }
  }

  for (const { g } of byKey.values()) recomputeGroup(g);
  return out;
}

/**
 * Merge and deduplicate supplier items
 * Deduplication logic: same article+brand+name
 * Keep item with best stock or lowest price
 */
export function mergeAndDeduplicate(items: SupplierItem[]): SupplierItem[] {
  const map = new Map<string, SupplierItem>();

  for (const item of items) {
    const key = `${item.article.toLowerCase()}_${(item.brand || "").toLowerCase()}_${item.name.toLowerCase()}`;

    const existing = map.get(key);

    if (!existing) {
      map.set(key, item);
      continue;
    }

    // Keep item with better stock, or lower price if stock is equal
    if (
      item.stock > existing.stock ||
      (item.stock === existing.stock && item.price < existing.price)
    ) {
      map.set(key, item);
    }
  }

  return Array.from(map.values());
}

/**
 * Группирует предложения по article+brand в SupplierGroup[].
 * Предложения внутри группы сортируются «в наличии → быстрее → дешевле»
 * (compareOffers).
 */
export function groupOffers(
  items: SupplierItem[],
  applyMarkup: (basePrice: number, ctx: { brand?: string }) => number
): SupplierGroup[] {
  const groups = new Map<string, SupplierGroup>();

  // Лучшее (наименее битое) название на каждый article+brand — среди ВСЕХ строк,
  // даже отсеянных ниже по цене/остатку: иначе единственный «живой» офер с битым
  // именем («Р С С Р») победил бы чистый дубль («крюк») того же товара.
  const bestName = new Map<string, string>();
  for (const item of items) {
    const key = `${normalizeArticle(item.article)}|${brandKey(canonicalBrand(item.brand))}`;
    const cand = repairSupplierName(item.name || "");
    const cur = bestName.get(key);
    if (cur === undefined || nameScore(cand) > nameScore(cur)) {
      bestName.set(key, cand);
    }
  }

  for (const item of items) {
    // Защита от «пустых» оферов от поставщиков: цена или остаток ≤ 0 —
    // нечего выставлять. Иначе один такой offer обнуляет minPrice
    // на карточке поиска.
    if (!Number.isFinite(item.price) || item.price <= 0) continue;
    if (!Number.isFinite(item.stock) || item.stock <= 0) continue;

    const brand = canonicalBrand(item.brand);
    // Ключ группировки по каноничному бренду: разные написания одного бренда
    // (LAND ROVER / LANDROVER, и любые варианты из BRAND_MAP) дают один ключ и
    // схлопываются в одну карточку, как и обещает их единое отображаемое имя.
    const key = `${normalizeArticle(item.article)}|${brandKey(brand)}`;

    const offer: SupplierOffer = {
      supplier: item.supplier,
      supplierCode: item.supplierCode || "unknown",
      price: item.price,
      ourPrice: applyMarkup(item.price, { brand }),
      stock: item.stock,
      deliveryDays: item.deliveryDays ?? null,
      sourceOfferId: item.sourceOfferId,
    };

    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        article: normalizeArticle(item.article),
        brand,
        name: bestName.get(key) ?? repairSupplierName(item.name),
        minPrice: offer.ourPrice,
        maxPrice: offer.ourPrice,
        totalStock: offer.stock,
        minDeliveryDays: offer.deliveryDays,
        offers: [offer],
      });
      continue;
    }

    existing.offers.push(offer);
    existing.totalStock += offer.stock;
    if (offer.ourPrice < existing.minPrice) existing.minPrice = offer.ourPrice;
    if (offer.ourPrice > existing.maxPrice) existing.maxPrice = offer.ourPrice;
    if (
      offer.deliveryDays != null &&
      (existing.minDeliveryDays == null ||
        offer.deliveryDays < existing.minDeliveryDays)
    ) {
      existing.minDeliveryDays = offer.deliveryDays;
    }
  }

  for (const group of groups.values()) recomputeGroup(group);

  return Array.from(groups.values()).sort((a, b) => a.minPrice - b.minPrice);
}

/**
 * Run multiple supplier searches in parallel with timeout.
 * Возвращает плоский список предложений от всех поставщиков и складов
 * (без дедупликации — группировка должна делаться вызывающей стороной
 * через groupOffers, чтобы сохранить все оферы).
 */
export async function searchAllSuppliers(
  adapters: SupplierAdapter[],
  params: SearchParams,
  timeout = 8000
): Promise<SupplierItem[]> {
  const promises = adapters.map(async (adapter) => {
    try {
      return await Promise.race([
        adapter.search(params),
        new Promise<SupplierItem[]>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), timeout)
        ),
      ]);
    } catch (error) {
      console.error("Supplier search error:", error);
      return [];
    }
  });

  const results = await Promise.all(promises);
  return results.flat();
}
