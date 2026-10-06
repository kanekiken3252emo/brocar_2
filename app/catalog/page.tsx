import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CatalogClient, { type InitialData } from "./CatalogClient";
import { getCategoryMeta, CAR_BRAND_META } from "@/lib/catalog/classifier";
import { Breadcrumbs, type Crumb } from "@/components/Breadcrumbs";
import {
  brandCatalogUrl,
  categoryCatalogUrl,
  parseCatalogPageParam,
} from "@/lib/catalog/urls";
import { JsonLd } from "@/components/seo/JsonLd";
import { SITE_URL, itemListSchema } from "@/lib/seo/structured-data";

// Базовый URL для серверного fetch к собственному API (внутри контейнера Next
// слушает 127.0.0.1:3000). Переопределяется через INTERNAL_API_BASE при нужде.
const INTERNAL_BASE = process.env.INTERNAL_API_BASE || "http://127.0.0.1:3000";

type CatalogSearchParams = Record<string, string | string[] | undefined>;

function hasListingModifiers(sp: CatalogSearchParams): boolean {
  return Object.keys(sp).some(
    (key) =>
      key !== "category" &&
      key !== "brand" &&
      key !== "page" &&
      // Next.js сохраняет параметр исходного rewrite-маршрута во внутренних
      // searchParams. Это не пользовательский фильтр и не отдельный URL.
      key !== "slug"
  );
}

async function ensureCatalogPageExists(
  kind: "category" | "car-brand",
  slug: string,
  page: number
): Promise<void> {
  if (page <= 1) return;

  let outOfRange = false;
  try {
    const res = await fetch(
      `${INTERNAL_BASE}/api/catalog/${kind}/${encodeURIComponent(
        slug
      )}?page=${page}&limit=20&sort=name`,
      { next: { revalidate: 600 }, signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const data = await res.json();
      const count = Number(data.count) || 0;
      const totalPages = Math.max(1, Math.ceil(count / 20));
      outOfRange = page > totalPages;
    }
  } catch {
    // При временной недоступности API не превращаем рабочий URL в ложный 404.
  }

  if (outOfRange) notFound();
}

/**
 * SEO-метаданные каталога. Чистые страницы пагинации категорий и марок —
 * самостоятельные индексируемые URL с self-canonical. Поиск, фильтры и сортировка
 * остаются неиндексируемыми и канонизируются на чистую страницу выдачи.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const category = typeof sp.category === "string" ? sp.category : undefined;
  const brand = typeof sp.brand === "string" ? sp.brand : undefined;
  const page = parseCatalogPageParam(sp.page);
  const hasSearch =
    typeof sp.article === "string" || typeof sp.vin === "string";
  const hasModifiers = hasListingModifiers(sp);

  if (page === null) notFound();

  if (category && !brand && !hasSearch) {
    if (!hasModifiers) {
      await ensureCatalogPageExists("category", category, page);
    }
    const meta = getCategoryMeta(category);
    const title = meta?.title ?? category;
    const canonical = categoryCatalogUrl(category, page);
    return {
      title:
        page > 1
          ? `${title} купить в Екатеринбурге - страница ${page}`
          : `${title} купить в Екатеринбурге - цены`,
      description:
        page > 1
          ? `Страница ${page}: ${title} в Екатеринбурге - цены, наличие и сроки доставки. Оригинальные запчасти и аналоги, подбор по VIN в BroCar.`
          : `Купить ${title} в Екатеринбурге: цены, наличие и сроки доставки. Оригинальные запчасти и аналоги, подбор по VIN в интернет-магазине BroCar.`,
      alternates: { canonical },
      // Категории вне справочника в индекс не пускаем (тонкие/мусорные страницы).
      robots:
        meta && !hasModifiers
          ? { index: true, follow: true }
          : { index: false, follow: Boolean(meta) },
    };
  }

  if (brand && !category && !hasSearch) {
    if (!hasModifiers) {
      await ensureCatalogPageExists("car-brand", brand, page);
    }
    const meta = CAR_BRAND_META.find(
      (b) => b.slug.toLowerCase() === brand.toLowerCase()
    );
    const title = meta?.title ?? brand.toUpperCase();
    const canonical = brandCatalogUrl(brand, page);
    return {
      title:
        page > 1
          ? `Купить запчасти для ${title} в Екатеринбурге - страница ${page}`
          : `Купить запчасти для ${title} в Екатеринбурге - цены`,
      description:
        page > 1
          ? `Страница ${page}: запчасти для ${title} в Екатеринбурге - цены, наличие и сроки доставки. Оригинальные запчасти и аналоги, подбор по VIN в BroCar.`
          : `Купить запчасти для ${title} в Екатеринбурге: цены, наличие и сроки доставки. Оригинальные запчасти и аналоги, подбор по VIN в интернет-магазине BroCar.`,
      alternates: { canonical },
      // Марки вне справочника (Baic/Москвич/опечатки) — страница работает, но
      // в индекс не идёт: у неё нет товаров, это защита от мусора в поиске.
      robots:
        meta && !hasModifiers
          ? { index: true, follow: true }
          : { index: false, follow: Boolean(meta) },
    };
  }

  return {
    title: "Каталог автозапчастей — купить онлайн с доставкой",
    description:
      "Каталог автозапчастей BroCar: 180 000+ товаров в наличии, оригинал и аналоги. Подбор по марке, категории и VIN. Доставка по Екатеринбургу и всей России!",
    alternates: { canonical: "/catalog" },
    robots:
      Object.keys(sp).length === 0
        ? { index: true, follow: true }
        : { index: false, follow: true },
  };
}

/**
 * Серверная обёртка каталога. Для «чистого» захода в КАТЕГОРИЮ (/catalog?category=…)
 * или МАРКУ авто (/catalog?brand=…) — без фильтров/сортировки/поиска — подгружает
 * первую страницу НА СЕРВЕРЕ и отдаёт товары прямо в HTML: у нового пользователя
 * нет клиентского водопада «шелл → JS → запрос → рендер», товары видны сразу (и их
 * видят поисковики). Остальные сценарии (фильтры, поиск по артикулу/VIN, brand+model)
 * грузятся клиентом как раньше — там initialData не передаётся, и CatalogClient
 * ведёт себя ровно как прежде.
 *
 * Данные берём из тех же роутов с Next Data Cache (revalidate) — серверный рендер
 * быстрый и не дублирует логику.
 */
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const sp = await searchParams;
  const category = typeof sp.category === "string" ? sp.category : undefined;
  const brand = typeof sp.brand === "string" ? sp.brand : undefined;
  const page = parseCatalogPageParam(sp.page);

  if (page === null) notFound();

  // Параметр page является частью чистой серверной выдачи. Любой другой
  // модификатор оставляет прежний клиентский сценарий поиска/фильтрации.
  const noModifiers = !hasListingModifiers(sp);

  let initialData: InitialData | undefined;
  let outOfRange = false;
  try {
    if (category && !brand && noModifiers) {
      // ВАЖНО: таймаут на самозапрос. Без него зависший API-роут (пул БД занят)
      // вешал SSR всех страниц каталога до 5 минут (дефолт undici) — соединения
      // копились, nginx рвал их, посетители видели белые страницы. Лучше отдать
      // страницу без initialData (клиент догрузит), чем повесить весь сайт.
      const res = await fetch(
        `${INTERNAL_BASE}/api/catalog/category/${encodeURIComponent(
          category
        )}?page=${page}&limit=20&sort=name`,
        { next: { revalidate: 600 }, signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        const data = await res.json();
        initialData = {
          mode: "category",
          key: category,
          groups: data.groups ?? [],
          title: data.title ?? null,
          count: data.count ?? 0,
          availableBrands: data.availableBrands ?? [],
          facets: data.facets ?? [],
        };
        const totalPages = Math.max(1, Math.ceil(initialData.count / 20));
        outOfRange = page > totalPages;
      }
    } else if (brand && !category && noModifiers) {
      const res = await fetch(
        `${INTERNAL_BASE}/api/catalog/car-brand/${encodeURIComponent(
          brand
        )}?page=${page}&limit=20&sort=name`,
        { next: { revalidate: 600 }, signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        const data = await res.json();
        initialData = {
          mode: "brand",
          key: brand,
          groups: data.groups ?? [],
          // Клиент показывает заголовок марки как «Запчасти для <title>».
          title: data.title ? `Запчасти для ${data.title}` : null,
          count: data.count ?? 0,
          availableBrands: data.availableBrands ?? [],
          facets: [],
        };
        const totalPages = Math.max(1, Math.ceil(initialData.count / 20));
        outOfRange = page > totalPages;
      }
    }
  } catch {
    // Сервер не смог подгрузить — не страшно: клиент догрузит сам, как раньше.
  }

  if (outOfRange) notFound();

  // Крошки — только для «чистого» захода в категорию/марку (это SEO-лендинги).
  // Для поиска/VIN/фильтров иерархии нет — крошки не показываем.
  let crumbs: Crumb[] | null = null;
  if (category && !brand && noModifiers) {
    const title = getCategoryMeta(category)?.title ?? category;
    const pageTitle =
      page > 1 ? `${title} в Екатеринбурге - страница ${page}` : title;
    crumbs = [
      { name: "Главная", href: "/" },
      { name: "Каталог", href: "/catalog" },
      { name: pageTitle, href: categoryCatalogUrl(category, page) },
    ];
  } else if (brand && !category && noModifiers) {
    const title =
      CAR_BRAND_META.find((b) => b.slug.toLowerCase() === brand.toLowerCase())
        ?.title ?? brand.toUpperCase();
    const pageTitle = page > 1 ? `${title} - страница ${page}` : title;
    crumbs = [
      { name: "Главная", href: "/" },
      { name: "Каталог", href: "/catalog" },
      { name: pageTitle, href: brandCatalogUrl(brand, page) },
    ];
  }

  return (
    <>
      {crumbs && (
        <div className="container mx-auto px-4 pt-5">
          <Breadcrumbs items={crumbs} />
        </div>
      )}
      {/* ItemList: машиночитаемый список товаров текущей страницы лендинга —
          ровно тех, что уже отрендерены в HTML (initialData). */}
      {initialData && crumbs && initialData.groups.length > 0 && (
        <JsonLd
          data={itemListSchema({
            name: initialData.title ?? crumbs[2].name,
            url: `${SITE_URL}${crumbs[2].href}`,
            count: initialData.groups.length,
            items: initialData.groups.map((g) => ({
              name: [g.brand, g.article, g.name].filter(Boolean).join(" "),
              url: `${SITE_URL}/product/${encodeURIComponent(g.article)}?brand=${encodeURIComponent(g.brand)}`,
            })),
          })}
        />
      )}
      <CatalogClient
        key={`${category ?? ""}|${brand ?? ""}|${page}`}
        initialData={initialData}
        initialPage={page}
        brandParam={brand}
        categoryParam={category}
      />
    </>
  );
}
