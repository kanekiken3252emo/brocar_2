import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, productStocks } from "@/lib/db/schema";
import { eq, desc, asc, and, sql as dsql, inArray } from "drizzle-orm";
import type { SupplierGroup, SupplierOffer } from "@/lib/suppliers/adapter";
import { dedupeGroups, isValidPrice, MAX_PLAUSIBLE_PRICE } from "@/lib/suppliers/adapter";
import { getCategoryMeta } from "@/lib/catalog/classifier";
import {
  ATTRIBUTE_META,
  makeFacetComparator,
  type AttributeMeta,
} from "@/lib/catalog/attributes";
import { lookupCachedBatch } from "@/lib/product-images";
import { getVegaName } from "@/lib/vega-names";
import { CACHE_LISTING } from "@/lib/http-cache";
import { withServerTiming } from "@/lib/server-timing";

interface FacetOption {
  value: string;
  count: number;
}
interface Facet {
  key: string;
  label: string;
  options: FacetOption[];
}

/** Условие containment: товар с attributes, содержащим {key: value}. */
function attrContains(key: string, value: string) {
  return dsql`${products.attributes} @> ${JSON.stringify({ [key]: value })}::jsonb`;
}

/**
 * Читает категорию напрямую из импортированного каталога Supabase.
 * Было: параллельно опрашивали Berg/Rossko/ShATE-M API (~10 сек).
 * Стало: одна SQL-выборка (~100 мс).
 *
 * Актуальные цены на момент покупки всё равно идут через API (см.
 * /api/product/[article]) — там запрашиваем свежие офферы.
 */
async function getHandler(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const meta = getCategoryMeta(slug);

    const url = new URL(request.url);
    // Серверная пагинация: limit=20 (одна страница каталога), page=1..N.
    // Клиент при смене страницы/фильтра/сортировки делает новый fetch,
    // получает только нужные 20 товаров — никаких 3MB-JSON, никаких
    // пустых страниц после 10-й.
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam
      ? Math.min(Math.max(parseInt(limitParam, 10), 1), 100)
      : 20;
    // Поддерживаем оба: ?page=N (предпочтительный) и legacy ?offset=N.
    const pageParam = url.searchParams.get("page");
    const offsetParam = url.searchParams.get("offset");
    const offset = pageParam
      ? Math.max(parseInt(pageParam, 10) - 1, 0) * limit
      : Math.max(parseInt(offsetParam || "0", 10), 0);
    const sort = url.searchParams.get("sort") || "name"; // дефолт — по названию
    const brandFilter = url.searchParams.get("brand")?.trim() || "";

    // Фасетные атрибуты этой категории (если описаны в ATTRIBUTE_META).
    // Активные значения берём из query-параметров вида attr_<key>=значение.
    const attrMeta: AttributeMeta[] = ATTRIBUTE_META[slug] ?? [];
    const activeAttrs = attrMeta
      .map((m) => ({
        meta: m,
        value: url.searchParams.get(`attr_${m.key}`)?.trim() || "",
      }))
      .filter((a) => a.value);

    const orderBy = (() => {
      switch (sort) {
        case "price-desc":
          return desc(products.ourPrice);
        case "stock":
          return desc(products.stock);
        case "name":
          return asc(products.name);
        default:
          return asc(products.ourPrice);
      }
    })();

    // Базовые условия выборки (категория + только что в наличии).
    // Раньше тут был фильтр source='berg' — он прятал ~88% каталога, т.к.
    // теперь по cron импортируются ещё forum-auto/rossko/shate-m/armtek.
    // Показываем товары всех поставщиков: предложения собираются из
    // product_stocks (есть у всех), а dedupeGroups склеивает один артикул от
    // разных поставщиков в одну карточку с несколькими офферами.
    const baseConditions = [
      eq(products.categorySlug, slug),
      dsql`${products.stock} > 0`,
      // Прячем позиции с битой ценой: NaN (Армтек-импорт пишет его в numeric, а
      // Postgres сортирует NaN ВЫШЕ всех при price-desc — отчего такая позиция
      // всплывала первой и роняла каталог) и баркод-мусор (цены в сотни млн+).
      // `> 0` отсекает ноль/отрицательные; `< MAX` отсекает и NaN (NaN < X даёт
      // false), и нереальные суммы. Условие в WHERE держит выборку, счётчик и
      // фасеты на одном множестве — пагинация не съезжает.
      dsql`${products.ourPrice} > 0`,
      dsql`${products.ourPrice} < ${MAX_PLAUSIBLE_PRICE}`,
    ];
    // Условия с учётом фильтров (бренд + атрибуты) — используем для productRows
    // и для count'а, чтобы пагинация и числа совпадали.
    const attrConditions = activeAttrs.map((a) =>
      attrContains(a.meta.key, a.value)
    );
    const conditionsWithFilter = [
      ...baseConditions,
      ...(brandFilter ? [eq(products.brand, brandFilter)] : []),
      ...attrConditions,
    ];
    // Список брендов считаем БЕЗ фильтра по цене (our_price). Эти условия НЕ входят
    // в индекс (category_slug, brand), поэтому запрос лез бы в кучу по ВСЕЙ
    // категории (heap fetches) — до ~6с на холодную. Мусорных цен в БД больше нет
    // (импортёр их не пускает + почищено), так что фильтр для списка брендов
    // избыточен. Без него — Index Only Scan по idx_products_cat_brand_instock (~5мс).
    const brandConditions = [
      eq(products.categorySlug, slug),
      dsql`${products.stock} > 0`,
      ...attrConditions,
    ];

    // Запросы, не зависящие друг от друга, — ПАРАЛЛЕЛЬНО (одна «волна» вместо
    // нескольких последовательных round-trip'ов к удалённой Supabase).
    const [productRows, countRows, brandRows, facets] = await Promise.all([
      // Страница товаров (категория + фильтры, сортировка, пагинация).
      db
        .select({
          id: products.id,
          article: products.article,
          brand: products.brand,
          name: products.name,
          ourPrice: products.ourPrice,
          supplierPrice: products.supplierPrice,
          stock: products.stock,
        })
        .from(products)
        .where(and(...conditionsWithFilter))
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
      // Общее количество для пагинации.
      db
        .select({ count: dsql<number>`COUNT(*)::int` })
        .from(products)
        .where(and(...conditionsWithFilter)),
      // Список всех брендов категории (без brand-фильтра, с учётом атрибутов).
      // Без price-фильтра (см. brandConditions) → index-only, быстро на холодную.
      db
        .selectDistinct({ brand: products.brand })
        .from(products)
        .where(and(...brandConditions)),
      // Фасеты: по каждому атрибуту — доступные значения и счётчики (каждый —
      // по выборке, отфильтрованной всеми ДРУГИМИ активными фильтрами).
      Promise.all(
        attrMeta.map(async (m): Promise<Facet> => {
          const otherAttrConds = activeAttrs
            .filter((a) => a.meta.key !== m.key)
            .map((a) => attrContains(a.meta.key, a.value));
          const valueExpr = dsql<string>`(${products.attributes} ->> ${m.key})`;
          const rows = await db
            .select({ value: valueExpr, count: dsql<number>`COUNT(*)::int` })
            .from(products)
            .where(
              and(
                ...baseConditions,
                ...(brandFilter ? [eq(products.brand, brandFilter)] : []),
                ...otherAttrConds,
                dsql`(${products.attributes} ->> ${m.key}) IS NOT NULL`
              )
            )
            // GROUP BY по порядковому номеру: повторное встраивание valueExpr
            // создало бы другой bind-параметр, и Postgres не считал бы его тем же.
            .groupBy(dsql`1`);
          const cmp = makeFacetComparator(m);
          const options: FacetOption[] = rows
            .map((r) => ({ value: String(r.value), count: Number(r.count) }))
            .filter((o) => o.value)
            .sort((a, b) => cmp(a.value, b.value));
          return { key: m.key, label: m.label, options };
        })
      ),
    ]);

    const count = countRows[0]?.count ?? 0;
    // Список брендов для выпадашки (без учёта самого brand-фильтра).
    const availableBrands = brandRows
      .map((r) => r.brand)
      .filter((b): b is string => Boolean(b))
      .sort();

    // Остатки по складам и кэш картинок не зависят друг от друга — оба нужны
    // лишь для товаров текущей страницы (бренд/артикул берём из productRows).
    // Тянем их ОДНОЙ параллельной волной, а не двумя последовательными —
    // экономим round-trip к удалённой Supabase. Узкое место — именно сетевая
    // задержка (~200мс/запрос), сами запросы выполняются <1мс.
    const ids = productRows.map((p) => p.id);
    type StockRow = typeof productStocks.$inferSelect;
    const [stockRows, imageCache] = await Promise.all([
      ids.length
        ? db
            .select()
            .from(productStocks)
            .where(inArray(productStocks.productId, ids))
        : Promise.resolve([] as StockRow[]),
      lookupCachedBatch(
        productRows.map((p) => ({ brand: p.brand ?? "", article: p.article }))
      ),
    ]);

    const stocksByProduct = new Map<number, StockRow[]>();
    for (const s of stockRows) {
      const list = stocksByProduct.get(s.productId) ?? [];
      list.push(s);
      stocksByProduct.set(s.productId, list);
    }

    // Сборка SupplierGroup[] в формате, ожидаемом фронтендом.
    const groups: SupplierGroup[] = productRows.map((p) => {
      const stocks = stocksByProduct.get(p.id) ?? [];
      const offers: SupplierOffer[] = stocks
        .map((s) => ({
          // Анонимизированное имя склада (VEGA N) — реальные warehouse_name
          // (напр. «BERG EKB») наружу не отдаём.
          supplier: getVegaName(s.supplierCode),
          supplierCode: s.supplierCode,
          price: Number(s.supplierPrice),
          ourPrice: Number(s.ourPrice),
          stock: s.quantity,
          deliveryDays: s.deliveryDays ?? null,
        }))
        // Отдельный офер тоже может нести битую цену (NaN/мусор) при валидном
        // товаре — без отсева Math.min(…, NaN) = NaN снова обнулил бы minPrice
        // в null и уронил карточку.
        .filter((o) => isValidPrice(o.ourPrice));

      offers.sort((a, b) => a.ourPrice - b.ourPrice);

      const prices = offers.map((o) => o.ourPrice);
      const deliveries = offers
        .map((o) => o.deliveryDays)
        .filter((d): d is number => d != null);
      const totalStock = offers.reduce((a, o) => a + o.stock, 0);

      return {
        article: p.article,
        brand: p.brand ?? "",
        name: p.name,
        minPrice: prices.length ? Math.min(...prices) : Number(p.ourPrice),
        maxPrice: prices.length ? Math.max(...prices) : Number(p.ourPrice),
        totalStock: totalStock || p.stock,
        minDeliveryDays: deliveries.length ? Math.min(...deliveries) : null,
        offers,
      };
    });

    // Подсеваем картинки из заранее загруженного кэша (imageCache получен выше,
    // параллельно с остатками). Пробрасываем только готовые URL; negative-cache
    // (null) не отдаём — для таких клиент сам сходит в /api/product-image.
    const norm = (s: string) => s.trim().toLowerCase();
    const enriched = dedupeGroups(groups).map((g) => {
      const url = imageCache.get(`${norm(g.brand)}|${norm(g.article)}`);
      return typeof url === "string" && url.length > 0
        ? { ...g, imageUrl: url }
        : g;
    });

    // dedupeGroups всегда сортирует по minPrice ASC, затирая SQL ORDER BY.
    // Возвращаем порядок, соответствующий запрошенному sort, иначе
    // «сначала дорогое» показывало бы страницу по возрастанию.
    enriched.sort((a, b) => {
      switch (sort) {
        case "price-desc":
          return b.minPrice - a.minPrice;
        case "stock":
          return b.totalStock - a.totalStock;
        case "name":
          return a.name.localeCompare(b.name, "ru");
        default:
          return a.minPrice - b.minPrice;
      }
    });

    return NextResponse.json({
      slug,
      title: meta?.title ?? slug,
      description: meta?.description ?? null,
      groups: enriched,
      count,
      limit,
      offset,
      page: Math.floor(offset / limit) + 1,
      availableBrands,
      facets,
    }, { headers: { "Cache-Control": CACHE_LISTING } });
  } catch (error) {
    console.error("Catalog category route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const GET = withServerTiming(getHandler);
