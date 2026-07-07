"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Grid3x3,
  List,
  Loader2,
  ArrowLeft,
  ChevronDown,
  Package,
  ScanLine,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import { getGuideForCategory } from "@/lib/guides";
import { categoryCatalogUrl } from "@/lib/catalog/urls";
import { bergClient } from "@/lib/bergClient";
import SupplierItemCard from "@/components/Items/SupplierItemCard";
import SupplierGroupListItem from "@/components/Items/SupplierGroupListItem";
import CategoryFacets, { type Facet } from "@/components/catalog/CategoryFacets";
import { Button } from "@/components/ui/button";
import type { SupplierGroup } from "@/lib/suppliers/adapter";
import type { BergResource } from "@/types/berg-api";
import { seedProductImageCache } from "@/lib/hooks/useProductImage";

/**
 * Засеять in-memory кэш картинок до того как карточки смонтируются.
 * Серверный роут уже положил готовые imageUrl в каждую группу
 * (см. enrichGroupsWithImages), нам остаётся только переложить их в кэш.
 * После этого useProductImage в каждой карточке найдёт URL мгновенно
 * и не пойдёт в /api/product-image.
 */
function seedImagesFromGroups(groups: SupplierGroup[]): void {
  for (const g of groups) {
    if (g.imageUrl !== undefined) {
      seedProductImageCache(g.brand, g.article, g.imageUrl);
    }
  }
}

interface CategoryHub {
  slug: string;
  title: string;
  count: number;
}

/**
 * Данные первой страницы категории ИЛИ марки авто, отрендеренные на СЕРВЕРЕ
 * (см. app/catalog/page.tsx). Передаются в клиентский компонент, чтобы товары
 * были в HTML сразу, без клиентского водопада «шелл → JS → запрос → рендер».
 */
export interface InitialData {
  mode: "category" | "brand";
  key: string; // categorySlug (mode=category) или марка (mode=brand)
  groups: SupplierGroup[];
  title: string | null;
  count: number;
  availableBrands: string[];
  facets: Facet[];
}

/**
 * Определяет, является ли поисковый запрос свободным текстом
 * (название/описание), а не артикулом. Артикулы у автозапчастей —
 * латиница + цифры с возможными `-./_`. Кириллица или несколько слов —
 * почти гарантированно описание.
 */
function isFreeText(query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  if (/[а-яёА-ЯЁ]/.test(q)) return true;
  // Многословные запросы трактуем как описание ТОЛЬКО если parseQuery не смог
  // распознать в них пару "бренд + артикул". См. parseQuery — она вызывается
  // в обработчике поиска и решает, идти ли в supplier API или text-search.
  if (/\s/.test(q)) {
    const parsed = parseQuery(q);
    return parsed.isText;
  }
  return false;
}

/**
 * Парсит поисковую строку и определяет — это артикул, пара бренд+артикул,
 * или свободный текст.
 *
 * Эвристика: бренд автозапчастей — токен из ТОЛЬКО латинских букв
 * (Toyota, Bosch, MILES, XYG, DEPO, …). Артикул — всё остальное: токены
 * с цифрами (KE100, ALSP085, 0986452041) или со спецсимволами (LFW/X,
 * ST-42510-TA0-A00). У артикула могут быть пробелы внутри (KE100 LFW/X
 * у XYG-стёкол), мы склеиваем все «не-чисто-буквенные» токены подряд.
 *
 * Примеры:
 *   "ALSP085"            → { article: "ALSP085" }
 *   "MILES ALSP085"      → { article: "ALSP085", brand: "MILES" }
 *   "0986452041 Bosch"   → { article: "0986452041", brand: "Bosch" }
 *   "1336 CC" / "1336-CC"→ { article: "1336CC" }  (CC — короткий хвост артикула, НЕ бренд)
 *   "KE100 LFW/X"        → { article: "KE100LFW/X" }  (слэш сохраняем — часть артикула)
 *   "XYG KE100 LFW/X"    → { article: "KE100LFW/X", brand: "XYG" }
 *   "MILES SUPER ALSP085"→ { article: "ALSP085", brand: "MILES SUPER" }
 *   "масляный фильтр"    → { isText: true }
 */
function parseQuery(query: string): {
  article?: string;
  brand?: string;
  isText: boolean;
} {
  const q = query.trim();
  if (!q) return { isText: true };
  if (/[а-яёА-ЯЁ]/.test(q)) return { isText: true };

  // Канонизация артикула для поставщиков: убираем пробелы/дефисы/точки внутри
  // (1 457 429 870 == 1457429870, 1336-CC == 1336CC — поставщики хранят слитно),
  // но СЛЭШ оставляем — он может быть значимой частью артикула (XYG LFW/X ≠ LFWX).
  const canonArticle = (s: string) => s.replace(/[\s.\-]+/g, "");

  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 1)
    return { article: canonArticle(tokens[0]), isText: false };

  // Бренд = токен из чисто латинских букв ДЛИНОЙ ≥3 (Bosch, MILES, XYG, NGK…).
  // Короткие буквенные хвосты (CC, X, AB) — это часть артикула, а НЕ бренд:
  // иначе «1336 CC» теряет «CC» и ищет чужой артикул «1336».
  const isBrandToken = (s: string) => /^[a-zA-Z]{3,}$/.test(s);
  const articleTokens = tokens.filter((t) => !isBrandToken(t));
  const brandTokens = tokens.filter(isBrandToken);

  // Совсем нет «артикульных» токенов — это слова, ищем как текст.
  if (articleTokens.length === 0) return { isText: true };

  // Бренд снимаем только если рядом есть «настоящий» артикул (с цифрой):
  // «MILES ALSP085» → brand=MILES, art=ALSP085; но «ABC DEF» (два буквенных
  // слова без цифр) → текстовый поиск, бренд не выдёргиваем.
  const hasNumericArticle = articleTokens.some((t) => /\d/.test(t));
  if (!hasNumericArticle && brandTokens.length > 0) return { isText: true };

  const article = canonArticle(articleTokens.join(" "));
  const brand = brandTokens.length > 0 ? brandTokens.join(" ") : undefined;

  return { article, brand, isText: false };
}

function CatalogContent({
  initialData,
  brandParam,
  categoryParam,
}: {
  initialData?: InitialData;
  brandParam?: string;
  categoryParam?: string;
}) {
  const searchParams = useSearchParams();

  const vin = searchParams?.get("vin");
  const article = searchParams?.get("article");
  // brand/category приходят ПРОПСОМ с сервера: чистый URL
  // /catalog/brand|category/<slug> rewrite'ится в ?brand=/?category=, но
  // клиентский useSearchParams видит только адресную строку (без query) — значит
  // берём из пропса. Фолбэк на searchParams — для голого /catalog и совместимости.
  const brand = brandParam ?? searchParams?.get("brand");
  const model = searchParams?.get("model");
  const category = categoryParam ?? searchParams?.get("category");
  // Откуда пришли: при заходе из VIN-каталога (кнопка «Цены» на схеме узла)
  // ссылка несёт исходный VIN — он нужен только чтобы кнопка «Назад» вернула
  // на ту же схему, а не на главную. На выборку товаров не влияет.
  const fromVin = searchParams?.get("fromVin");

  // Серверный засев первого показа: страница пришла server-rendered с готовыми
  // данными категории ИЛИ марки (initialData) и URL — «чистый» заход в ту же
  // категорию/марку (без поиска/VIN/модели). Тогда стартуем сразу с товарами и
  // НЕ делаем повторный запрос. Любое изменение (фильтр/сортировка/страница)
  // дальше работает как раньше. Если initialData нет — поведение идентично прежнему.
  const seedable =
    !!initialData &&
    !vin &&
    !article &&
    !model &&
    ((initialData.mode === "category" &&
      initialData.key === category &&
      !brand) ||
      (initialData.mode === "brand" &&
        initialData.key === brand &&
        !category));

  const [groups, setGroups] = useState<SupplierGroup[]>(() => {
    if (seedable) {
      seedImagesFromGroups(initialData!.groups);
      return initialData!.groups;
    }
    return [];
  });
  const [categoryTitle, setCategoryTitle] = useState<string | null>(
    seedable ? initialData!.title : null
  );
  const [categoryHub, setCategoryHub] = useState<CategoryHub[] | null>(null);
  const [loading, setLoading] = useState(!seedable);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  // Режим текстового поиска: exact — точные совпадения, relaxed — «похожие»,
  // fuzzy — найдено по сходству («вы имели в виду»). Управляет баннером.
  const [searchMode, setSearchMode] = useState<"exact" | "relaxed" | "fuzzy">(
    "exact"
  );

  const [brandFilter, setBrandFilter] = useState<string>("");
  // По умолчанию сортируем по названию (алфавит) — так выдача предсказуема и
  // её удобно листать; цену/срок/наличие пользователь выбирает сам. Серверный
  // первичный рендер (app/catalog/page.tsx) использует тот же дефолт, иначе на
  // первом экране был бы рассинхрон «дропдаун: по названию / данные: по цене».
  const [sortBy, setSortBy] = useState<
    "price-asc" | "price-desc" | "name" | "delivery"
  >("name");

  // Фасетные фильтры по характеристикам (приходят с сервера для категории).
  // facets — доступные значения, attrFilters — что выбрал пользователь.
  const [facets, setFacets] = useState<Facet[]>(
    seedable ? initialData!.facets : []
  );
  const [attrFilters, setAttrFilters] = useState<Record<string, string>>({});

  const handleAttrChange = (key: string, value: string) => {
    setAttrFilters((prev) => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Серверная пагинация: для category/car-brand веток `groups` приходит уже
  // отфильтрованным, отсортированным и спагинированным с сервера. count и
  // availableBrands приходят оттуда же. Для article/vin/text-search пагинация
  // остаётся клиентской (там источники возвращают сразу всё).
  const useServerPagination = Boolean(
    category || (brand && !model && !article)
  );
  const [serverTotalCount, setServerTotalCount] = useState(
    seedable ? initialData!.count : 0
  );
  const [serverBrands, setServerBrands] = useState<string[]>(
    seedable ? initialData!.availableBrands : []
  );

  // Активный AbortController — отменяем предыдущий запрос при старте нового,
  // чтобы устаревший ответ не перетёр актуальные groups (race condition при
  // нескольких ре-рендерах подряд от useSearchParams + setCurrentPage).
  const activeRequestRef = useRef<AbortController | null>(null);

  // Если первый показ засеян с сервера (seedable) — пропускаем самый первый
  // loadProducts: товары уже в состоянии. Все последующие изменения параметров
  // грузятся как обычно.
  const skipFirstLoad = useRef(seedable);

  // Сбрасываем номер страницы на 1 при смене параметров, которые меняют
  // саму выборку (другая категория, бренд, фильтр, сортировка). Используем
  // функциональный setState чтобы не перезапускать loadProducts если
  // currentPage уже был 1.
  useEffect(() => {
    setCurrentPage((p) => (p === 1 ? p : 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vin, article, brand, model, category, brandFilter, sortBy, attrFilters]);

  // Смена категории/поиска сбрасывает выбранные характеристики — иначе фильтр
  // «вязкость 5W-40» утёк бы из масел в чужую категорию.
  useEffect(() => {
    setAttrFilters({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vin, article, brand, model, category]);

  useEffect(() => {
    if (skipFirstLoad.current) {
      skipFirstLoad.current = false;
      return;
    }
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vin, article, brand, model, category, currentPage, brandFilter, sortBy, attrFilters]);

  const loadProducts = async () => {
    // Отменяем предыдущий запрос если он ещё в полёте — иначе его поздний
    // ответ перетрёт результат текущего (race condition при нескольких
    // ре-рендерах подряд).
    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;
    const { signal } = controller;

    setLoading(true);
    setError(null);
    setCategoryTitle(null);
    setCategoryHub(null);
    setSearchMode("exact");
    setFacets([]);

    try {
      // sort из UI в API: API понимает price-asc/price-desc/name/stock.
      // "delivery" сервер не поддерживает — пусть отсортирует по price-asc,
      // на клиенте затем dosortBy delivery — это применится только в
      // пределах текущей страницы из 20, но при выборе сортировки по
      // delivery это компромисс.
      const apiSort =
        sortBy === "price-asc" ||
        sortBy === "price-desc" ||
        sortBy === "name"
          ? sortBy
          : "price-asc";

      if (category) {
        // Каталог из импортированной БД (Berg). Серверная пагинация.
        const params = new URLSearchParams({
          page: String(currentPage),
          limit: String(itemsPerPage),
          sort: apiSort,
        });
        if (brandFilter) params.set("brand", brandFilter);
        for (const [k, v] of Object.entries(attrFilters)) {
          if (v) params.set(`attr_${k}`, v);
        }
        const res = await fetch(
          `/api/catalog/category/${encodeURIComponent(category)}?${params.toString()}`,
          { signal }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Ошибка загрузки категории");
        }
        const data: {
          groups: SupplierGroup[];
          title: string;
          count?: number;
          availableBrands?: string[];
          facets?: Facet[];
        } = await res.json();
        if (signal.aborted) return;
        const groups = data.groups || [];
        seedImagesFromGroups(groups);
        setGroups(groups);
        setServerTotalCount(data.count ?? groups.length);
        setServerBrands(data.availableBrands ?? []);
        setFacets(data.facets ?? []);
        setCategoryTitle(data.title || null);
      } else if (brand && !model && !article) {
        // Страница марки авто: товары из БД с этой маркой в car_brands. Серверная пагинация.
        const params = new URLSearchParams({
          page: String(currentPage),
          limit: String(itemsPerPage),
          sort: apiSort,
        });
        if (brandFilter) params.set("brand", brandFilter);
        const res = await fetch(
          `/api/catalog/car-brand/${encodeURIComponent(brand)}?${params.toString()}`,
          { signal }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Ошибка загрузки");
        }
        const data: {
          groups: SupplierGroup[];
          title: string;
          count?: number;
          availableBrands?: string[];
        } = await res.json();
        if (signal.aborted) return;
        const groups = data.groups || [];
        seedImagesFromGroups(groups);
        setGroups(groups);
        setServerTotalCount(data.count ?? groups.length);
        setServerBrands(data.availableBrands ?? []);
        setCategoryTitle(data.title ? `Запчасти для ${data.title}` : null);
      } else if (article) {
        // Разбираем поисковую строку: один артикул, "BRAND ARTICLE" / "ARTICLE BRAND",
        // или свободный текст (описание/кириллица).
        const parsed = parseQuery(article);
        if (parsed.isText) {
          // Свободный текст («масляный фильтр») — ищем в Supabase по названию.
          // У API поставщиков поиска по описанию нет.
          const res = await fetch(
            `/api/catalog/text-search?q=${encodeURIComponent(
              article
            )}&sort=${sortBy}`,
            { signal }
          );
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || "Ошибка поиска");
          }
          const data: {
            groups: SupplierGroup[];
            mode?: "exact" | "relaxed" | "fuzzy";
          } = await res.json();
          if (signal.aborted) return;
          const groups = data.groups || [];
          seedImagesFromGroups(groups);
          setGroups(groups);
          setSearchMode(data.mode ?? "exact");
        } else {
          // Мульти-поставщиковый поиск по артикулу (и бренду, если распарсили).
          // brand из URL имеет приоритет — например, при переходе с карточки бренда.
          const res = await fetch("/api/suppliers/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              article: parsed.article,
              ...(brand
                ? { brand }
                : parsed.brand
                ? { brand: parsed.brand }
                : {}),
            }),
            signal,
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || "Ошибка поиска");
          }
          const data: { groups: SupplierGroup[] } = await res.json();
          if (signal.aborted) return;
          const groups = data.groups || [];
          seedImagesFromGroups(groups);
          setGroups(groups);
        }
      } else if (vin) {
        // VIN ищем только по Berg (Rossko не поддерживает VIN).
        // Конвертируем BergResource → SupplierGroup на лету.
        const response = await bergClient.searchByVIN(vin);
        if (signal.aborted) return;
        setGroups(bergResourcesToGroups(response.resources || []));
      } else if (brand && model) {
        const response = await bergClient.searchByArticle("", {
          brandName: brand,
          analogs: true,
        });
        if (signal.aborted) return;
        setGroups(bergResourcesToGroups(response.resources || []));
      } else {
        // Нет ни одного параметра — показываем хаб с категориями
        setGroups([]);
        const res = await fetch("/api/catalog/categories", { signal });
        if (res.ok) {
          const data: { categories: CategoryHub[] } = await res.json();
          if (signal.aborted) return;
          setCategoryHub(data.categories || []);
        }
      }
    } catch (err: any) {
      // AbortError — это «нас отменили», не показываем как ошибку.
      if (err?.name === "AbortError" || signal.aborted) return;
      console.error("Catalog load error:", err);
      setError(err.message || "Не удалось загрузить товары");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  };

  // Бренды для выпадающего фильтра: на серверной пагинации список приходит
  // от API (отражает все бренды в выборке, а не только в текущих 20). Иначе
  // собираем по полученным группам.
  const availableBrands = useServerPagination
    ? serverBrands
    : Array.from(new Set(groups.map((g) => g.brand).filter(Boolean))).sort();

  // Текстовый поиск («компрессор кондиционера»), а не артикул/категория/VIN.
  // Тогда сервер уже вернул товары в порядке РЕЛЕВАНТНОСТИ (целое слово > часть,
  // имя > артикул), и для дефолта «Сначала подходящие» мы этот порядок СОХРАНЯЕМ,
  // а не пересортировываем по алфавиту. Цена/срок — выбор пользователя — ниже
  // всё равно применяются.
  const isTextSearch = !!article && isFreeText(article);

  // Для serverPagination фильтрация/сортировка уже применены сервером,
  // а пагинация = текущая страница. Клиентский фильтр/sort всё равно
  // прогоняем для пользовательского sort=delivery (его API не знает).
  const filtered = useServerPagination
    ? groups
    : groups.filter((g) => (brandFilter ? g.brand === brandFilter : true));

  const sorted = useServerPagination
    ? // На серверной пагинации не пересортировываем, КРОМЕ delivery —
      // его сервер не знает, а delivery работает в пределах одной страницы.
      sortBy === "delivery"
      ? [...filtered].sort(
          (a, b) =>
            (a.minDeliveryDays ?? 999) - (b.minDeliveryDays ?? 999)
        )
      : filtered
    : isTextSearch && sortBy === "name"
    ? // «Сначала подходящие»: сохраняем порядок релевантности от сервера.
      filtered
    : [...filtered].sort((a, b) => {
        switch (sortBy) {
          case "price-asc":
            return a.minPrice - b.minPrice;
          case "price-desc":
            return b.minPrice - a.minPrice;
          case "name":
            return a.name.localeCompare(b.name);
          case "delivery":
            return (a.minDeliveryDays ?? 999) - (b.minDeliveryDays ?? 999);
          default:
            return 0;
        }
      });

  const totalCount = useServerPagination ? serverTotalCount : filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  // На серверной пагинации `sorted` уже = 20 нужных товаров текущей страницы.
  const paginated = useServerPagination
    ? sorted
    : sorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Сайдбар характеристик показываем только в режиме категории и только если
  // у неё есть фасеты (сервер их вернул). Для поиска по артикулу/VIN — нет.
  const showFacetSidebar = Boolean(category) && facets.length > 0;

  // Статья «Помощь с выбором» для текущей категории (если есть готовая).
  const categoryGuide = category ? getGuideForCategory(category) : undefined;

  const getSearchSummary = () => {
    // Лендинги категорий/марок: коммерческий H1 в связке с meta-title
    // («Масла моторные — купить в Екатеринбурге»).
    if (categoryTitle) return `${categoryTitle} — купить в Екатеринбурге`;
    if (vin) return `Поиск по VIN: ${vin}`;
    if (article)
      return isFreeText(article)
        ? `Поиск: ${article}`
        : `Поиск по артикулу: ${article}`;
    if (brand && model) return `${brand} ${model}`;
    if (brand) return `Бренд: ${brand}`;
    return "Каталог автозапчастей";
  };

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="container mx-auto px-4 py-5 md:py-6">
        <div className="mb-5">
          <Link
            href={fromVin ? `/catalog-vin?vin=${encodeURIComponent(fromVin)}` : "/"}
            className="inline-flex items-center text-orange-500 hover:text-orange-400 mb-3 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {fromVin ? "Назад в каталог по VIN" : "Вернуться на главную"}
          </Link>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-1.5">
                {getSearchSummary()}
              </h1>
              {totalCount > 0 && (
                <p className="text-neutral-400">
                  Найдено товаров:{" "}
                  <span className="text-white font-semibold">
                    {totalCount}
                  </span>
                </p>
              )}
              {article && isFreeText(article) && totalCount > 0 && (
                <p className="text-neutral-500 text-xs mt-1.5 max-w-xl">
                  Не нашли нужное? Введите артикул — поиск по артикулу шире
                  (все поставщики в реальном времени, включая оригинальные позиции).
                </p>
              )}
            </div>
            <Link
              href="/catalog-vin"
              className="inline-flex items-center justify-center gap-2 shrink-0 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm md:text-base px-5 py-3 rounded-xl transition-colors"
            >
              <ScanLine className="w-5 h-5" />
              Поиск по VIN
            </Link>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {(showFacetSidebar || categoryGuide) && (
            <aside className="w-full lg:w-64 xl:w-72 shrink-0 lg:sticky lg:top-4 space-y-4">
              {showFacetSidebar && (
                <CategoryFacets
                  facets={facets}
                  values={attrFilters}
                  onChange={handleAttrChange}
                  onReset={() => {
                    setAttrFilters({});
                    setBrandFilter("");
                  }}
                  brandOptions={availableBrands}
                  brandValue={brandFilter}
                  onBrandChange={setBrandFilter}
                />
              )}

              {/* Помощь с выбором — статья для этой категории */}
              {categoryGuide && (
                <Link
                  href={`/guides/${categoryGuide.slug}`}
                  className="group block bg-neutral-900 border border-orange-500/30 rounded-2xl p-4 hover:border-orange-500/60 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-orange-500/15 rounded-lg flex items-center justify-center shrink-0">
                      <BookOpen className="w-4 h-4 text-orange-400" />
                    </div>
                    <p className="text-xs text-orange-400 font-semibold uppercase tracking-wide">
                      Помощь с выбором
                    </p>
                  </div>
                  <p className="text-white font-semibold text-sm mb-2 leading-snug">
                    {categoryGuide.title}
                  </p>
                  <span className="inline-flex items-center gap-1 text-sm text-orange-400 font-medium group-hover:gap-2 transition-all">
                    Читать статью
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </Link>
              )}
            </aside>
          )}
          <div className="flex-1 min-w-0 w-full">
        {groups.length > 0 && searchMode !== "exact" && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 mb-6 flex items-start gap-3">
            <Search className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
            <p className="text-sm text-neutral-200">
              {searchMode === "fuzzy" ? (
                <>
                  Точных совпадений нет. Возможно, вы искали что-то из
                  показанного ниже — мы подобрали похожее по написанию.
                </>
              ) : (
                <>
                  Точных совпадений по запросу не нашлось — показываем похожие
                  товары. Уточните запрос или проверьте раскладку.
                </>
              )}
            </p>
          </div>
        )}

        {groups.length > 0 && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 mb-6">
            <div className="flex flex-wrap items-end gap-4">
              {availableBrands.length > 1 && !showFacetSidebar && (
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-neutral-400 mb-1.5">
                    Производитель
                  </label>
                  <div className="relative">
                    <select
                      value={brandFilter}
                      onChange={(e) => setBrandFilter(e.target.value)}
                      className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-white appearance-none focus:border-orange-500 focus:outline-none transition-colors"
                    >
                      <option value="">Все производители</option>
                      {availableBrands.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 pointer-events-none" />
                  </div>
                </div>
              )}

              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-neutral-400 mb-2">
                  Сортировка
                </label>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-white appearance-none focus:border-orange-500 focus:outline-none transition-colors"
                  >
                    {/* В режиме поиска дефолт — «Сначала подходящие» (тот же
                        sort=name, но клиент сохраняет порядок релевантности от
                        сервера). В каталоге/по марке — обычная сортировка по имени. */}
                    {isTextSearch && (
                      <option value="name">Сначала подходящие</option>
                    )}
                    <option value="price-asc">Цена: по возрастанию</option>
                    <option value="price-desc">Цена: по убыванию</option>
                    <option value="delivery">По сроку доставки</option>
                    {!isTextSearch && <option value="name">По названию</option>}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 pointer-events-none" />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2.5 rounded-xl transition-colors ${
                    viewMode === "grid"
                      ? "bg-orange-500 text-white"
                      : "bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-700"
                  }`}
                  title="Сетка"
                >
                  <Grid3x3 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2.5 rounded-xl transition-colors ${
                    viewMode === "list"
                      ? "bg-orange-500 text-white"
                      : "bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-700"
                  }`}
                  title="Список"
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-orange-500 mb-4" />
            <span className="text-lg text-neutral-400">Загрузка товаров...</span>
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <Button onClick={loadProducts} variant="destructive">
              Попробовать снова
            </Button>
          </div>
        )}

        {!loading && !error && groups.length === 0 && categoryHub && categoryHub.length > 0 && (
          <div>
            <div className="mb-6">
              <p className="text-neutral-400">
                Выберите категорию запчастей
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {categoryHub.map((c) => (
                <Link
                  key={c.slug}
                  href={categoryCatalogUrl(c.slug)}
                  className="group bg-neutral-900 border border-neutral-800 rounded-2xl p-5 hover:border-orange-500/50 transition-all hover:shadow-lg hover:shadow-orange-500/10"
                >
                  <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-orange-500/20 transition-colors">
                    <Package className="w-6 h-6 text-orange-500" />
                  </div>
                  <div className="text-lg font-bold text-white group-hover:text-orange-400 transition-colors">
                    {c.title}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    {c.count.toLocaleString("ru-RU")} товаров
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && groups.length === 0 && (!categoryHub || categoryHub.length === 0) && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center">
            <div className="w-20 h-20 bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Search className="w-10 h-10 text-neutral-600" />
            </div>
            <h3 className="text-2xl font-semibold text-white mb-3">
              Товары не найдены
            </h3>
            <p className="text-neutral-400 mb-4 max-w-md mx-auto">
              Проверьте раскладку клавиатуры и написание, попробуйте другое
              название — либо подберите деталь по VIN.
            </p>
            {article && isFreeText(article) && (
              <p className="text-neutral-300 text-sm mb-8 max-w-lg mx-auto bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3">
                💡 Знаете <span className="text-white font-medium">артикул</span>?
                Введите его — поиск по артикулу охватывает всех поставщиков в
                реальном времени, включая оригинальные и заказные позиции,
                которых нет в поиске по названию.
              </p>
            )}
            <Link
              href={
                fromVin ? `/catalog-vin?vin=${encodeURIComponent(fromVin)}` : "/"
              }
            >
              <Button size="lg">
                {fromVin ? "Назад в каталог по VIN" : "Вернуться на главную"}
              </Button>
            </Link>
          </div>
        )}

        {!loading && paginated.length > 0 && (
          <>
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {paginated.map((group, index) => (
                  <SupplierItemCard
                    key={`${group.article}-${group.brand}`}
                    group={group}
                    // В каталоге кнопку «в корзину» с карточки убрали — клик по
                    // карточке всегда ведёт на страницу товара (там и покупка).
                    showAddToCart={false}
                    // Первые 8 карточек — это первый экран (xl:grid-cols-4 ×
                    // 2 ряда). priority даёт next/image preload-подсказку,
                    // что ускоряет LCP — Lighthouse как раз выбирает одну из
                    // верхних карточек как LCP-элемент.
                    priority={index < 8}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {paginated.map((group) => (
                  <SupplierGroupListItem
                    key={`${group.article}-${group.brand}`}
                    group={group}
                  />
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-12 flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-5 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-300 hover:border-orange-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Назад
                </button>

                <div className="flex gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (page) =>
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 2 && page <= currentPage + 2)
                    )
                    .map((page, index, array) => {
                      if (index > 0 && page - array[index - 1] > 1) {
                        return (
                          <span
                            key={`ellipsis-${page}`}
                            className="px-3 py-2.5 text-neutral-500"
                          >
                            ...
                          </span>
                        );
                      }
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-4 py-2.5 rounded-xl font-medium transition-colors ${
                            currentPage === page
                              ? "bg-orange-500 text-white"
                              : "bg-neutral-800 border border-neutral-700 text-neutral-300 hover:border-orange-500/50"
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                </div>

                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-5 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-300 hover:border-orange-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Вперед
                </button>
              </div>
            )}
          </>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Конвертирует BergResource[] (ответ VIN-поиска Berg) в SupplierGroup[]
 * с теми же типами, что и общий эндпоинт /api/suppliers/search.
 * Используется только пока Rossko/другие поставщики не поддерживают VIN —
 * после миграции VIN-поиска на серверную часть этот код удалим.
 */
function bergResourcesToGroups(resources: BergResource[]): SupplierGroup[] {
  return resources.map((r) => {
    const offers = (r.offers || []).map((o) => {
      const price = Number(o.price) || 0;
      const markup = Math.round(Math.max(price * 1.15, price + 200));
      return {
        supplier: `Berg (${o.warehouse?.name || "склад"})`,
        supplierCode: "berg",
        price,
        ourPrice: markup,
        stock: Number(o.quantity) || 0,
        deliveryDays:
          o.average_period != null ? Number(o.average_period) : null,
      };
    });

    const prices = offers.map((o) => o.ourPrice).filter((p) => p > 0);
    const stocks = offers.reduce((sum, o) => sum + o.stock, 0);
    const delivery = offers
      .map((o) => o.deliveryDays)
      .filter((d): d is number => d != null);

    return {
      article: r.article || "",
      brand: r.brand?.name || "",
      name: r.name || "",
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      totalStock: stocks,
      minDeliveryDays: delivery.length ? Math.min(...delivery) : null,
      offers: offers.sort((a, b) => a.ourPrice - b.ourPrice),
    };
  });
}

export default function CatalogClient({
  initialData,
  brandParam,
  categoryParam,
}: {
  initialData?: InitialData;
  brandParam?: string;
  categoryParam?: string;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-neutral-950">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500" />
        </div>
      }
    >
      <CatalogContent
        initialData={initialData}
        brandParam={brandParam}
        categoryParam={categoryParam}
      />
    </Suspense>
  );
}
