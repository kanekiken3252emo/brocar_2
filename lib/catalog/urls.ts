/**
 * Чистые URL лендингов каталога:
 *   марка авто → /catalog/brand/<slug>
 *   категория  → /catalog/category/<slug>
 *
 * Слаги приводим к нижнему регистру: car-brand API регистронезависим
 * (slug.toUpperCase() внутри), категории и так в нижнем. Внутри эти пути
 * rewrite'ятся в /catalog?brand=/?category= (см. next.config.ts), а старые
 * query-URL 301-редиректятся сюда — поэтому старые ссылки не ломаются.
 */
export function brandCatalogUrl(slug: string): string {
  return `/catalog/brand/${encodeURIComponent(slug.toLowerCase())}`;
}

export function categoryCatalogUrl(slug: string): string {
  return `/catalog/category/${encodeURIComponent(slug.toLowerCase())}`;
}
