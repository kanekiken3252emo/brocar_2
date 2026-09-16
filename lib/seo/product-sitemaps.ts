import "server-only";
import {
  PRODUCT_SEO_WAVE_BATCHES,
  PRODUCT_SEO_WAVES,
  type ProductWaveItem,
} from "@/lib/seo/product-wave";

export const PRODUCT_SITEMAP_PAGE_SIZE = 45_000;

export type IndexableProductRow = {
  article: string;
  brand: string;
  lastModified: Date;
};

function toIndexableRows(products: ProductWaveItem[]): IndexableProductRow[] {
  return products.map((item) => ({
    article: item.article,
    brand: item.brand,
    lastModified: new Date(item.lastModified),
  }));
}

/** Возвращает опубликованные приоритетные SEO-волны карточек. */
export async function getIndexableProducts(): Promise<IndexableProductRow[]> {
  return toIndexableRows(PRODUCT_SEO_WAVES);
}

/** Возвращает одну опубликованную SEO-волну для отдельного sitemap. */
export async function getIndexableProductWave(
  waveId: number
): Promise<IndexableProductRow[] | null> {
  const products = PRODUCT_SEO_WAVE_BATCHES[waveId];
  return products ? toIndexableRows(products) : null;
}

export async function getIndexableProductCount(): Promise<number> {
  return PRODUCT_SEO_WAVES.length;
}

export function getProductSitemapCount(): number {
  return PRODUCT_SEO_WAVE_BATCHES.length;
}
