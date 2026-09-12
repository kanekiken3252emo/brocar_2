import "server-only";
import snapshot from "@/data/seo-indexed-product-snapshot.json";
import { brandKey, canonicalBrand } from "@/lib/brands/canonical.mjs";
import { sameBrandFamily } from "@/lib/brands/families.mjs";
import { normalizeArticle } from "@/lib/suppliers/adapter";
import {
  isUsableProductName,
  repairSupplierName,
} from "@/lib/suppliers/mojibake";

export type ProductSeoSnapshotItem = {
  article: string;
  requestedBrand: string;
  brand: string;
  name: string;
  minPrice: number | null;
  sourceUrl: string;
  evidenceUrl?: string;
};

const items = (snapshot.products as ProductSeoSnapshotItem[])
  .map((item) => ({ ...item, name: repairSupplierName(item.name) }))
  .filter((item) => isUsableProductName(item.name, item.article, item.brand));

const exact = new Map<string, ProductSeoSnapshotItem>();
const byArticle = new Map<string, ProductSeoSnapshotItem[]>();

for (const item of items) {
  const article = normalizeArticle(item.article);
  const requestedBrand = brandKey(canonicalBrand(item.requestedBrand));
  const resolvedBrand = brandKey(canonicalBrand(item.brand));

  if (requestedBrand) exact.set(`${article}|${requestedBrand}`, item);
  if (resolvedBrand) exact.set(`${article}|${resolvedBrand}`, item);

  const articleItems = byArticle.get(article) ?? [];
  articleItems.push(item);
  byArticle.set(article, articleItems);
}

/**
 * Стабильное имя из однократного снимка живого ответа поставщиков.
 * Оно нужно только карточкам, у которых первый HTML раньше содержал заглушку
 * или повреждённое наименование. Цены и остатки снимок не подменяет.
 */
export function getProductSeoSnapshot(
  article: string,
  brand?: string | null
): ProductSeoSnapshotItem | null {
  const normalizedArticle = normalizeArticle(article);
  const normalizedBrand = brandKey(canonicalBrand(brand));

  if (normalizedBrand) {
    const exactItem = exact.get(`${normalizedArticle}|${normalizedBrand}`);
    if (exactItem) return exactItem;

    const familyItems = (byArticle.get(normalizedArticle) ?? []).filter((item) =>
      sameBrandFamily(brand, item.requestedBrand || item.brand)
    );
    if (familyItems.length === 1) return familyItems[0];
    if (familyItems.length > 1) {
      const first = familyItems[0];
      if (familyItems.every((item) => item.name === first.name)) return first;
    }
    return null;
  }

  const articleItems = byArticle.get(normalizedArticle) ?? [];
  const explicitlyUnbrandedItems = articleItems.filter(
    (item) => !brandKey(canonicalBrand(item.requestedBrand))
  );
  if (explicitlyUnbrandedItems.length === 1) return explicitlyUnbrandedItems[0];
  if (articleItems.length === 1) return articleItems[0];
  if (articleItems.length > 1) {
    const first = articleItems[0];
    const sameResolvedProduct = articleItems.every(
      (item) =>
        brandKey(canonicalBrand(item.brand)) ===
          brandKey(canonicalBrand(first.brand)) && item.name === first.name
    );
    if (sameResolvedProduct) return first;
  }
  return null;
}
