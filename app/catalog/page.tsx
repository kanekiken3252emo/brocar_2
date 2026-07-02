import type { Metadata } from "next";
import CatalogClient, { type InitialData } from "./CatalogClient";
import { getCategoryMeta, CAR_BRAND_META } from "@/lib/catalog/classifier";
import { Breadcrumbs, type Crumb } from "@/components/Breadcrumbs";
import { brandCatalogUrl, categoryCatalogUrl } from "@/lib/catalog/urls";

// Базовый URL для серверного fetch к собственному API (внутри контейнера Next
// слушает 127.0.0.1:3000). Переопределяется через INTERNAL_API_BASE при нужде.
const INTERNAL_BASE = process.env.INTERNAL_API_BASE || "http://127.0.0.1:3000";

/**
 * SEO-метаданные каталога. Каталог — одна страница с query-параметрами, поэтому
 * canonical задаём вручную:
 *  • заход в КАТЕГОРИЮ (?category=…) или МАРКУ (?brand=…) — это самостоятельный
 *    лендинг (он же в sitemap): свой title/description и self-canonical на тот же
 *    параметризованный URL, иначе корневой canonical «./» схлопнул бы его в /catalog;
 *  • всё остальное (голый каталог, поиск по артикулу/VIN, фильтры/сортировка/
 *    страницы) канонизируем в чистый /catalog — чтобы не плодить дубли.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const category = typeof sp.category === "string" ? sp.category : undefined;
  const brand = typeof sp.brand === "string" ? sp.brand : undefined;
  const hasSearch =
    typeof sp.article === "string" || typeof sp.vin === "string";

  if (category && !brand && !hasSearch) {
    const meta = getCategoryMeta(category);
    const title = meta?.title ?? category;
    return {
      title: `${title} — купить автозапчасти`,
      description:
        meta?.description ??
        `${title}: оригинальные запчасти, наличие и цены, доставка по России. Подбор и заказ в Brocar.`,
      alternates: { canonical: categoryCatalogUrl(category) },
      // Категории вне справочника в индекс не пускаем (тонкие/мусорные страницы).
      ...(meta ? {} : { robots: { index: false, follow: false } }),
    };
  }

  if (brand && !category && !hasSearch) {
    const meta = CAR_BRAND_META.find(
      (b) => b.slug.toLowerCase() === brand.toLowerCase()
    );
    const title = meta?.title ?? brand.toUpperCase();
    return {
      title: `Запчасти для ${title}`,
      description: `Автозапчасти для ${title}: оригинальные детали, подбор по каталогу и VIN, доставка по России. Заказывайте в Brocar.`,
      alternates: { canonical: brandCatalogUrl(brand) },
      // Марки вне справочника (Baic/Москвич/опечатки) — страница работает, но
      // в индекс не идёт: у неё нет товаров, это защита от мусора в поиске.
      ...(meta ? {} : { robots: { index: false, follow: false } }),
    };
  }

  return {
    title: "Каталог автозапчастей",
    description:
      "Каталог автозапчастей Brocar: оригинал и аналоги, подбор по категории, марке авто и VIN-коду, наличие и доставка по России.",
    alternates: { canonical: "/catalog" },
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
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const category = typeof sp.category === "string" ? sp.category : undefined;
  const brand = typeof sp.brand === "string" ? sp.brand : undefined;

  // «Чистый» заход — без модификаторов (сортировка/страница/фильтры/поиск — это
  // клиентские взаимодействия, в URL их нет при первом заходе из меню/хаба).
  const noModifiers =
    !sp.vin &&
    !sp.article &&
    !sp.model &&
    !sp.sort &&
    !sp.page &&
    !Object.keys(sp).some((k) => k.startsWith("attr_"));

  let initialData: InitialData | undefined;
  try {
    if (category && !brand && noModifiers) {
      const res = await fetch(
        `${INTERNAL_BASE}/api/catalog/category/${encodeURIComponent(
          category
        )}?page=1&limit=20&sort=name`,
        { next: { revalidate: 600 } }
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
      }
    } else if (brand && !category && noModifiers) {
      const res = await fetch(
        `${INTERNAL_BASE}/api/catalog/car-brand/${encodeURIComponent(
          brand
        )}?page=1&limit=20&sort=name`,
        { next: { revalidate: 600 } }
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
      }
    }
  } catch {
    // Сервер не смог подгрузить — не страшно: клиент догрузит сам, как раньше.
  }

  // Крошки — только для «чистого» захода в категорию/марку (это SEO-лендинги).
  // Для поиска/VIN/фильтров иерархии нет — крошки не показываем.
  let crumbs: Crumb[] | null = null;
  if (category && !brand && noModifiers) {
    const title = getCategoryMeta(category)?.title ?? category;
    crumbs = [
      { name: "Главная", href: "/" },
      { name: "Каталог", href: "/catalog" },
      { name: title, href: categoryCatalogUrl(category) },
    ];
  } else if (brand && !category && noModifiers) {
    const title =
      CAR_BRAND_META.find((b) => b.slug.toLowerCase() === brand.toLowerCase())
        ?.title ?? brand.toUpperCase();
    crumbs = [
      { name: "Главная", href: "/" },
      { name: "Каталог", href: "/catalog" },
      { name: title, href: brandCatalogUrl(brand) },
    ];
  }

  return (
    <>
      {crumbs && (
        <div className="container mx-auto px-4 pt-5">
          <Breadcrumbs items={crumbs} />
        </div>
      )}
      <CatalogClient
        initialData={initialData}
        brandParam={brand}
        categoryParam={category}
      />
    </>
  );
}
