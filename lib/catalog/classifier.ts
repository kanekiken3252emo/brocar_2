/**
 * Типизированная обёртка над общим модулем классификации.
 *
 * Все ПРАВИЛА (PATTERNS, бренды, exclude) живут в одном месте —
 * ./classifier-data.mjs — и используются как рантаймом Next.js (здесь),
 * так и скриптом импорта (scripts/import-berg-csv.mjs) напрямую.
 * Этот файл лишь добавляет TypeScript-типы поверх.
 */

import {
  CATEGORY_META as CATEGORY_META_RAW,
  CAR_BRAND_META as CAR_BRAND_META_RAW,
  getCategoryMeta as getCategoryMetaRaw,
  detectCategory as detectCategoryRaw,
  detectCarBrands as detectCarBrandsRaw,
} from "./classifier-data.mjs";

export interface CategoryMeta {
  slug: string;
  title: string;
  description?: string;
}

export interface CarBrandMeta {
  slug: string;
  title: string;
}

/** Пользовательские названия категорий для UI (порядок — порядок в меню). */
export const CATEGORY_META: CategoryMeta[] = CATEGORY_META_RAW;

/** Марки авто с человекочитаемым title. */
export const CAR_BRAND_META: CarBrandMeta[] = CAR_BRAND_META_RAW;

export function getCategoryMeta(slug: string): CategoryMeta | undefined {
  return getCategoryMetaRaw(slug);
}

/** Классифицировать товар по наименованию. Возвращает slug категории или 'misc'. */
export function detectCategory(name: string): string {
  return detectCategoryRaw(name);
}

/**
 * Возвращает массив slug'ов марок авто, упомянутых в наименовании.
 * Пустой массив если ничего не распознано (универсальный товар).
 */
export function detectCarBrands(name: string): string[] {
  return detectCarBrandsRaw(name);
}
