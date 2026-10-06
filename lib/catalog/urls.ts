/**
 * Чистые URL лендингов каталога:
 *   марка авто → /catalog/brand/<slug>
 *   категория  → /catalog/category/<slug>
 *
 * Слаги приводим к нижнему регистру: car-brand API регистронезависим
 * (slug.toUpperCase() внутри), категории и так в нижнем. Внутри эти пути
 * rewrite'ятся в /catalog?brand=/?category= (см. next.config.ts), а старые
 * query-URL 301-редиректятся сюда — поэтому старые ссылки не ломаются.
 *
 * ВАЖНО: слаг в URL — строго [a-z0-9-] (валидируется в middleware). Кириллица
 * или пробел в пути запускали петлю перекодирования (%d0→%25d0→%2525d0…) —
 * crawler trap в Яндексе. Поэтому отображаемые ИМЕНА марок здесь мапятся в
 * латинские слаги справочника (CAR_BRAND_META).
 */

/** Отображаемое имя марки → слаг справочника (для имён, не равных слагу). */
const BRAND_NAME_SLUGS: Record<string, string> = {
  "ваз": "lada",
  "лада": "lada",
  "газ": "gaz",
  "уаз": "uaz",
  "москвич": "moskvich", // в CAR_BRAND_META пока нет — страница будет пустой (noindex)
  "land rover": "land-rover",
};

function withCatalogPage(pathname: string, page = 1): string {
  return Number.isSafeInteger(page) && page > 1
    ? `${pathname}?page=${page}`
    : pathname;
}

export function parseCatalogPageParam(
  value: string | string[] | null | undefined
): number | null {
  if (value == null || value === "") return 1;
  if (Array.isArray(value) || !/^[1-9]\d*$/.test(value)) return null;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : null;
}

export function brandCatalogUrl(nameOrSlug: string, page = 1): string {
  const key = nameOrSlug.toLowerCase();
  const slug = BRAND_NAME_SLUGS[key] ?? key;
  return withCatalogPage(`/catalog/brand/${encodeURIComponent(slug)}`, page);
}

export function categoryCatalogUrl(slug: string, page = 1): string {
  return withCatalogPage(
    `/catalog/category/${encodeURIComponent(slug.toLowerCase())}`,
    page
  );
}
