import "server-only";
import wave1Manifest from "@/data/seo-product-wave-1.json";
import wave2Manifest from "@/data/seo-product-wave-2.json";
import wave3Manifest from "@/data/seo-product-wave-3.json";
import wave4Manifest from "@/data/seo-product-wave-4.json";
import wave5Manifest from "@/data/seo-product-wave-5.json";
import { brandKey, canonicalBrand } from "@/lib/brands/canonical.mjs";
import { normalizeArticle } from "@/lib/suppliers/adapter";

export type ProductWaveItem = {
  article: string;
  brand: string;
  brandKey: string;
  lastModified: string;
  seoBrand?: string;
  seoName?: string;
  seoMinPrice?: number | null;
};

export const PRODUCT_WAVE_1 = wave1Manifest.products as ProductWaveItem[];
export const PRODUCT_WAVE_2 = wave2Manifest.products as ProductWaveItem[];
export const PRODUCT_WAVE_3 = wave3Manifest.products as ProductWaveItem[];
export const PRODUCT_WAVE_4 = wave4Manifest.products as ProductWaveItem[];
export const PRODUCT_WAVE_5 = wave5Manifest.products as ProductWaveItem[];
export const PRODUCT_SEO_WAVE_BATCHES = [
  PRODUCT_WAVE_1,
  PRODUCT_WAVE_2,
  PRODUCT_WAVE_3,
  PRODUCT_WAVE_4,
  PRODUCT_WAVE_5,
];
export const PRODUCT_SEO_WAVES = [
  ...PRODUCT_WAVE_1,
  ...PRODUCT_WAVE_2,
  ...PRODUCT_WAVE_3,
  ...PRODUCT_WAVE_4,
  ...PRODUCT_WAVE_5,
];

const waveKeys = new Set(
  PRODUCT_SEO_WAVES.map(
    (item) =>
      `${normalizeArticle(item.article)}|${brandKey(canonicalBrand(item.brand))}`
  )
);

const wave5Keys = new Set(
  PRODUCT_WAVE_5.map(
    (item) =>
      `${normalizeArticle(item.article)}|${brandKey(canonicalBrand(item.brand))}`
  )
);

if (waveKeys.size !== PRODUCT_SEO_WAVES.length) {
  throw new Error("Published product SEO waves contain duplicate identities");
}

/** Проверяет, входит ли товар в одну из опубликованных SEO-волн. */
export function isProductInSeoWave(
  article: string,
  brand?: string | null
): boolean {
  if (!brand) return false;
  return waveKeys.has(
    `${normalizeArticle(article)}|${brandKey(canonicalBrand(brand))}`
  );
}

/** Проверяет, входит ли товар в пятую SEO-волну (`/sitemaps/products/4`). */
export function isProductInSeoWave5(
  article: string,
  brand?: string | null
): boolean {
  if (!brand) return false;
  return wave5Keys.has(
    `${normalizeArticle(article)}|${brandKey(canonicalBrand(brand))}`
  );
}
