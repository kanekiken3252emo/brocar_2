// Каноничный бренд: схлопывает разные написания одного бренда (STELLOX/Stellox)
// и в живых ответах поставщиков, как и в импортированном каталоге.
import { canonicalBrand, brandKey } from "../brands/canonical.mjs";

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
  raw?: unknown;
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
 *   2) затем по сроку доставки (быстрее — выше; «уточн.»/null — в конец);
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

  return a.ourPrice - b.ourPrice; // потом дешевле
}

/**
 * Сортировка ТОВАРОВ (групп) по той же логике, что и предложения:
 * «в наличии → быстрее → дешевле». Самые быстрые позиции (сегодня/завтра)
 * оказываются наверху. Используется для списка аналогов в карточке товара,
 * чтобы приоритет был у быстрых покупок (срок → цена).
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
    const key = `${normalizeArticle(g.article)}|${brandKey(g.brand)}`;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        ...g,
        article: normalizeArticle(g.article),
        brand: canonicalBrand(g.brand),
        offers: [...g.offers],
      });
      continue;
    }

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

  for (const g of map.values()) {
    g.offers.sort(compareOffers);
  }

  return Array.from(map.values()).sort((a, b) => a.minPrice - b.minPrice);
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
 * Предложения внутри группы сортируются «в наличии → дешевле» (compareOffers).
 */
export function groupOffers(
  items: SupplierItem[],
  applyMarkup: (basePrice: number, ctx: { brand?: string }) => number
): SupplierGroup[] {
  const groups = new Map<string, SupplierGroup>();

  for (const item of items) {
    // Защита от «пустых» оферов от поставщиков: цена или остаток ≤ 0 —
    // нечего выставлять. Иначе один такой offer обнуляет minPrice
    // на карточке поиска.
    if (!Number.isFinite(item.price) || item.price <= 0) continue;
    if (!Number.isFinite(item.stock) || item.stock <= 0) continue;

    const brand = canonicalBrand(item.brand);
    const key = `${normalizeArticle(item.article)}|${brandKey(item.brand)}`;

    const offer: SupplierOffer = {
      supplier: item.supplier,
      supplierCode: item.supplierCode || "unknown",
      price: item.price,
      ourPrice: applyMarkup(item.price, { brand }),
      stock: item.stock,
      deliveryDays: item.deliveryDays ?? null,
    };

    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        article: normalizeArticle(item.article),
        brand,
        name: item.name,
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

  for (const group of groups.values()) {
    group.offers.sort(compareOffers);
  }

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




