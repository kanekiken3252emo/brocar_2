import "server-only";
import { PRODUCT_WAVE_1 } from "@/lib/seo/product-wave";

export const PRODUCT_SITEMAP_PAGE_SIZE = 45_000;

export type IndexableProductRow = {
  article: string;
  brand: string;
  lastModified: Date;
};

/** Возвращает только фиксированную приоритетную волну из 1 883 карточек. */
export async function getIndexableProducts(): Promise<IndexableProductRow[]> {
  return PRODUCT_WAVE_1.map((item) => ({
    article: item.article,
    brand: item.brand,
    lastModified: new Date(item.lastModified),
  }));
}

export async function getIndexableProductCount(): Promise<number> {
  return PRODUCT_WAVE_1.length;
}

export function getProductSitemapCount(productCount: number): number {
  return Math.ceil(productCount / PRODUCT_SITEMAP_PAGE_SIZE);
}
