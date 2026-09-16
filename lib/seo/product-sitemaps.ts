import "server-only";
import { PRODUCT_SEO_WAVES } from "@/lib/seo/product-wave";

export const PRODUCT_SITEMAP_PAGE_SIZE = 45_000;

export type IndexableProductRow = {
  article: string;
  brand: string;
  lastModified: Date;
};

/** Возвращает опубликованные приоритетные SEO-волны карточек. */
export async function getIndexableProducts(): Promise<IndexableProductRow[]> {
  return PRODUCT_SEO_WAVES.map((item) => ({
    article: item.article,
    brand: item.brand,
    lastModified: new Date(item.lastModified),
  }));
}

export async function getIndexableProductCount(): Promise<number> {
  return PRODUCT_SEO_WAVES.length;
}

export function getProductSitemapCount(productCount: number): number {
  return Math.ceil(productCount / PRODUCT_SITEMAP_PAGE_SIZE);
}
