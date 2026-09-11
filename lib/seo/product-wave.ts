import "server-only";
import manifest from "@/data/seo-product-wave-1.json";
import { brandKey, canonicalBrand } from "@/lib/brands/canonical.mjs";
import { normalizeArticle } from "@/lib/suppliers/adapter";

export type ProductWaveItem = {
  article: string;
  brand: string;
  brandKey: string;
  lastModified: string;
};

export const PRODUCT_WAVE_1 = manifest.products as ProductWaveItem[];

const waveKeys = new Set(
  PRODUCT_WAVE_1.map(
    (item) =>
      `${normalizeArticle(item.article)}|${brandKey(canonicalBrand(item.brand))}`
  )
);

/** Проверяет, входит ли товар в приоритетную SEO-волну. */
export function isProductInWave1(article: string, brand?: string | null): boolean {
  if (!brand) return false;
  return waveKeys.has(
    `${normalizeArticle(article)}|${brandKey(canonicalBrand(brand))}`
  );
}
