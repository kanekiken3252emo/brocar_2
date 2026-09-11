import { canonicalBrand } from "@/lib/brands/canonical.mjs";
import { normalizeArticle } from "@/lib/suppliers/adapter";

/**
 * Единственный формат ссылки на карточку товара.
 *
 * Артикул без бренда не уникален: один и тот же нормализованный артикул может
 * принадлежать нескольким производителям. Поэтому brand является частью
 * канонического URL, а артикул и написание бренда всегда нормализуются.
 */
export function productUrl(article: string, brand?: string | null): string {
  const normalizedArticle = normalizeArticle(article);
  const normalizedBrand = canonicalBrand(brand);
  const path = `/product/${encodeURIComponent(normalizedArticle)}`;

  return normalizedBrand
    ? `${path}?brand=${encodeURIComponent(normalizedBrand)}`
    : path;
}
