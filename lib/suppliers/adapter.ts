/**
 * Generic supplier item interface
 */
export interface SupplierItem {
  article: string;
  brand?: string;
  name: string;
  price: number;
  stock: number;
  supplier: string;
  raw?: unknown;
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
 * Run multiple supplier searches in parallel with timeout
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
  const allItems = results.flat();

  return mergeAndDeduplicate(allItems);
}




