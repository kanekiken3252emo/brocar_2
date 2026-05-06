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
 * Предложения внутри группы сортируются по цене (по возрастанию).
 */
export function groupOffers(
  items: SupplierItem[],
  applyMarkup: (basePrice: number, ctx: { brand?: string }) => number
): SupplierGroup[] {
  const groups = new Map<string, SupplierGroup>();

  for (const item of items) {
    const brand = (item.brand || "").trim();
    const key = `${item.article.toLowerCase()}|${brand.toLowerCase()}`;

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
        article: item.article,
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
    group.offers.sort((a, b) => a.ourPrice - b.ourPrice);
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




