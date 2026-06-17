/**
 * Типизированная обёртка над общим модулем извлечения атрибутов.
 * Правила живут в ./attributes.mjs (его же напрямую импортируют скрипты),
 * здесь — только TypeScript-типы поверх.
 */
import {
  ATTRIBUTE_META as ATTRIBUTE_META_RAW,
  hasAttributes as hasAttributesRaw,
  extractAttributes as extractAttributesRaw,
  makeFacetComparator as makeFacetComparatorRaw,
} from "./attributes.mjs";

export interface AttributeMeta {
  /** Ключ в products.attributes (и в query-параметре attr_<key>). */
  key: string;
  /** Заголовок фасета в UI. */
  label: string;
  /** Способ сортировки значений фасета. */
  sort?: "viscosity" | "numeric" | "list";
  /** Явный порядок значений для sort: "list". */
  order?: string[];
}

/** Описание фасетов по категориям (slug → список атрибутов). */
export const ATTRIBUTE_META: Record<string, AttributeMeta[]> =
  ATTRIBUTE_META_RAW;

/** Есть ли у категории описанные фасеты. */
export function hasAttributes(slug: string): boolean {
  return hasAttributesRaw(slug);
}

/** Извлечь атрибуты товара по (категория, наименование). */
export function extractAttributes(
  categorySlug: string,
  name: string
): Record<string, string> {
  return extractAttributesRaw(categorySlug, name);
}

/** Компаратор значений фасета согласно его meta. */
export function makeFacetComparator(
  meta: AttributeMeta
): (a: string, b: string) => number {
  return makeFacetComparatorRaw(meta);
}
