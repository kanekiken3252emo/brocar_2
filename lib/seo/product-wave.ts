import "server-only";
import wave1Manifest from "@/data/seo-product-wave-1.json";
import wave2Manifest from "@/data/seo-product-wave-2.json";
import wave3Manifest from "@/data/seo-product-wave-3.json";
import wave4Manifest from "@/data/seo-product-wave-4.json";
import wave5Manifest from "@/data/seo-product-wave-5.json";
import wave6Manifest from "@/data/seo-product-wave-6.json";
import wave7Manifest from "@/data/seo-product-wave-7.json";
import wave8Manifest from "@/data/seo-product-wave-8.json";
import wave9Manifest from "@/data/seo-product-wave-9.json";
import wave10Manifest from "@/data/seo-product-wave-10.json";
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
export const PRODUCT_WAVE_6 = wave6Manifest.products as ProductWaveItem[];
export const PRODUCT_WAVE_7 = wave7Manifest.products as ProductWaveItem[];
export const PRODUCT_WAVE_8 = wave8Manifest.products as ProductWaveItem[];
export const PRODUCT_WAVE_9 = wave9Manifest.products as ProductWaveItem[];
export const PRODUCT_WAVE_10 = wave10Manifest.products as ProductWaveItem[];
export const PRODUCT_SEO_WAVE_BATCHES = [
  PRODUCT_WAVE_1,
  PRODUCT_WAVE_2,
  PRODUCT_WAVE_3,
  PRODUCT_WAVE_4,
  PRODUCT_WAVE_5,
  PRODUCT_WAVE_6,
  PRODUCT_WAVE_7,
  PRODUCT_WAVE_8,
  PRODUCT_WAVE_9,
  PRODUCT_WAVE_10,
];
export const PRODUCT_SEO_WAVES = [
  ...PRODUCT_WAVE_1,
  ...PRODUCT_WAVE_2,
  ...PRODUCT_WAVE_3,
  ...PRODUCT_WAVE_4,
  ...PRODUCT_WAVE_5,
  ...PRODUCT_WAVE_6,
  ...PRODUCT_WAVE_7,
  ...PRODUCT_WAVE_8,
  ...PRODUCT_WAVE_9,
  ...PRODUCT_WAVE_10,
];

const waveKeys = new Set(
  PRODUCT_SEO_WAVES.map(
    (item) =>
      `${normalizeArticle(item.article)}|${brandKey(canonicalBrand(item.brand))}`
  )
);

const enhancedOfferTableKeys = new Set(
  [
    ...PRODUCT_WAVE_5,
    ...PRODUCT_WAVE_6,
    ...PRODUCT_WAVE_7,
    ...PRODUCT_WAVE_8,
    ...PRODUCT_WAVE_9,
    ...PRODUCT_WAVE_10,
  ].map(
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

/** Проверяет, входит ли товар в SEO-волны с расширенной таблицей предложений. */
export function isProductInEnhancedOfferTableWave(
  article: string,
  brand?: string | null
): boolean {
  if (!brand) return false;
  return enhancedOfferTableKeys.has(
    `${normalizeArticle(article)}|${brandKey(canonicalBrand(brand))}`
  );
}
