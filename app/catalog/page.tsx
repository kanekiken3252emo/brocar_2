import CatalogClient, { type InitialData } from "./CatalogClient";

// Базовый URL для серверного fetch к собственному API (внутри контейнера Next
// слушает 127.0.0.1:3000). Переопределяется через INTERNAL_API_BASE при нужде.
const INTERNAL_BASE = process.env.INTERNAL_API_BASE || "http://127.0.0.1:3000";

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
        )}?page=1&limit=20&sort=price-asc`,
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
        )}?page=1&limit=20&sort=price-asc`,
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

  return <CatalogClient initialData={initialData} />;
}
