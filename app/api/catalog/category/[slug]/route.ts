import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, productStocks } from "@/lib/db/schema";
import { eq, desc, asc, and, sql as dsql, inArray } from "drizzle-orm";
import type { SupplierGroup, SupplierOffer } from "@/lib/suppliers/adapter";
import { dedupeGroups } from "@/lib/suppliers/adapter";
import { getCategoryMeta } from "@/lib/catalog/classifier";
import {
  ATTRIBUTE_META,
  makeFacetComparator,
  type AttributeMeta,
} from "@/lib/catalog/attributes";
import { enrichGroupsWithImages } from "@/lib/product-images";
import { getVegaName } from "@/lib/vega-names";

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
export async function GET(
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
    const sort = url.searchParams.get("sort") || "price-asc";
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

    const productRows = await db
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
      .offset(offset);

    // 2. Остатки по складам — одним запросом на весь набор id
    const ids = productRows.map((p) => p.id);
    const stockRows = ids.length
      ? await db
          .select()
          .from(productStocks)
          .where(inArray(productStocks.productId, ids))
      : [];

    const stocksByProduct = new Map<number, typeof stockRows>();
    for (const s of stockRows) {
      const list = stocksByProduct.get(s.productId) ?? [];
      list.push(s);
      stocksByProduct.set(s.productId, list);
    }

    // 3. Сборка SupplierGroup[] в формате ожидаемом фронтендом
    const groups: SupplierGroup[] = productRows.map((p) => {
      const stocks = stocksByProduct.get(p.id) ?? [];
      const offers: SupplierOffer[] = stocks.map((s) => ({
        // Анонимизированное имя склада (VEGA N) — реальные warehouse_name
        // (напр. «BERG EKB») наружу не отдаём.
        supplier: getVegaName(s.supplierCode),
        supplierCode: s.supplierCode,
        price: Number(s.supplierPrice),
        ourPrice: Number(s.ourPrice),
        stock: s.quantity,
        deliveryDays: s.deliveryDays ?? null,
      }));

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

    // 4. Общее количество для пагинации (с учётом brand-фильтра, чтобы
    //    цифра «Найдено N» соответствовала тому что доступно для скролла).
    const [{ count = 0 } = { count: 0 }] = await db
      .select({ count: dsql<number>`COUNT(*)::int` })
      .from(products)
      .where(and(...conditionsWithFilter));

    // 5. Список всех брендов в категории — для выпадашки фильтра.
    //    БЕЗ учёта самого brand-фильтра (иначе остался бы один вариант), но
    //    С учётом выбранных атрибутов — чтобы список брендов сужался под них.
    const brandRows = await db
      .selectDistinct({ brand: products.brand })
      .from(products)
      .where(and(...baseConditions, ...attrConditions));
    const availableBrands = brandRows
      .map((r) => r.brand)
      .filter((b): b is string => Boolean(b))
      .sort();

    // 6. Фасеты: для каждого атрибута категории — доступные значения и счётчики.
    //    Каждый фасет считается по выборке, отфильтрованной всеми ДРУГИМИ
    //    активными фильтрами (бренд + прочие атрибуты), но не собственным —
    //    чтобы внутри фасета всегда можно было переключить значение.
    const facets: Facet[] = await Promise.all(
      attrMeta.map(async (m) => {
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
          // создало бы другой bind-параметр для того же выражения, и Postgres
          // не считал бы его тем же (ошибка "must appear in GROUP BY").
          .groupBy(dsql`1`);
        const cmp = makeFacetComparator(m);
        const options: FacetOption[] = rows
          .map((r) => ({ value: String(r.value), count: Number(r.count) }))
          .filter((o) => o.value)
          .sort((a, b) => cmp(a.value, b.value));
        return { key: m.key, label: m.label, options };
      })
    );

    // Подсеваем картинки из кэша product_images — клиент не будет делать
    // N round-trip'ов к /api/product-image на рендере грида.
    const enriched = await enrichGroupsWithImages(dedupeGroups(groups));

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
    });
  } catch (error) {
    console.error("Catalog category route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
