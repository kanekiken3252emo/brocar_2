import { MetadataRoute } from "next";
import { GUIDES, isGuideReady } from "@/lib/guides";
import { CATEGORY_META, CAR_BRAND_META } from "@/lib/catalog/classifier";
import { brandCatalogUrl, categoryCatalogUrl } from "@/lib/catalog/urls";
import { client } from "@/lib/db";

// Карту сайта пересобираем не чаще раза в сутки (ISR): каталог и наличие меняются
// медленно, а единственный поход в БД (список непустых категорий/марок) при этом
// кэшируется — краулеры не дёргают базу на каждый запрос sitemap.xml.
export const revalidate = 86400;

/**
 * Slug'и категорий и марок авто, у которых СЕЙЧАС есть товар в наличии (Берг).
 * Пустые лендинги в карту не кладём — иначе поисковик получает «soft 404».
 * При сбое БД возвращаем null → фоллбэк «включить все известные из справочника»
 * (лучше отдать существующие страницы, чем пустой sitemap на транзиентной ошибке).
 */
async function getInStockSlugs(): Promise<{
  categories: Set<string>;
  brands: Set<string>;
} | null> {
  try {
    const [cats, brands] = await Promise.all([
      client<{ slug: string }[]>`
        SELECT DISTINCT category_slug AS slug FROM products
        WHERE source = 'berg' AND stock > 0 AND category_slug IS NOT NULL
      `,
      client<{ slug: string }[]>`
        SELECT DISTINCT UNNEST(car_brands) AS slug FROM products
        WHERE source = 'berg' AND stock > 0 AND car_brands IS NOT NULL
      `,
    ]);
    return {
      categories: new Set(cats.map((r) => r.slug)),
      brands: new Set(brands.map((r) => r.slug)),
    };
  } catch (e) {
    console.error("sitemap: не удалось получить непустые категории/марки:", e);
    return null;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteDomain = process.env.NEXT_PUBLIC_SITE_DOMAIN || "localhost:3000";
  const baseUrl = siteDomain.startsWith("localhost")
    ? `http://${siteDomain}`
    : `https://${siteDomain}`;

  const now = new Date();

  // ── Статические страницы ───────────────────────────────────────────────────
  const staticUrls: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/catalog`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/automarki`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/catalog-vin`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/vin-search`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/delivery`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/guides`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/contacts`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/legal/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${baseUrl}/legal/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${baseUrl}/legal/cookies`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${baseUrl}/legal/requisites`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
  ];

  // ── Гайды (только с готовым текстом, без заглушек «Скоро») ──────────────────
  const guideUrls: MetadataRoute.Sitemap = GUIDES.filter(isGuideReady).map((g) => ({
    url: `${baseUrl}/guides/${g.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  // ── Лендинги каталога: категории и марки авто ──────────────────────────────
  // URL-структура сайта — единая страница /catalog с query-параметром
  // (?category=… / ?brand=…), см. app/catalog/CatalogClient.tsx и AutomarkiClient.
  const inStock = await getInStockSlugs();
  const hasCategory = (slug: string) => !inStock || inStock.categories.has(slug);
  const hasBrand = (slug: string) => !inStock || inStock.brands.has(slug);

  const categoryUrls: MetadataRoute.Sitemap = CATEGORY_META.filter((c) =>
    hasCategory(c.slug)
  ).map((c) => ({
    url: `${baseUrl}${categoryCatalogUrl(c.slug)}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const brandUrls: MetadataRoute.Sitemap = CAR_BRAND_META.filter((b) =>
    hasBrand(b.slug)
  ).map((b) => ({
    url: `${baseUrl}${brandCatalogUrl(b.slug)}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [
    ...staticUrls,
    ...categoryUrls,
    ...brandUrls,
    ...guideUrls,
  ];
}
