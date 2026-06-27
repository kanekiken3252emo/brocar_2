"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProductImage from "@/components/Items/ProductImage";
import { formatDeliveryDays } from "@/lib/utils";
import {
  ArrowLeft,
  Clock,
  MapPin,
  ShoppingCart,
  CheckCircle,
  XCircle,
  Shield,
  Truck,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BergResource, BergOffer } from "@/types/berg-api";

// Сортировка предложений по клику на заголовок колонки. null = дефолтный порядок
// (как пришло от сервера: «в наличии → быстрее → дешевле»).
type SortField = "price" | "delivery" | "quantity" | "reliability";

const SORT_OPTIONS: { key: SortField; label: string; defaultDir: "asc" | "desc" }[] =
  [
    { key: "price", label: "Цена", defaultDir: "asc" },
    { key: "delivery", label: "Срок", defaultDir: "asc" },
    { key: "quantity", label: "Кол-во", defaultDir: "desc" },
    { key: "reliability", label: "Надёжность", defaultDir: "desc" },
  ];

function sortOffers(
  offers: BergOffer[],
  key: SortField | null,
  dir: "asc" | "desc"
): BergOffer[] {
  if (!key) return offers;
  const value = (o: BergOffer) =>
    key === "price"
      ? o.price
      : key === "delivery"
        ? o.average_period
        : key === "quantity"
          ? o.quantity
          : o.reliability;
  const sign = dir === "asc" ? 1 : -1;
  return [...offers].sort((a, b) => (value(a) - value(b)) * sign);
}
import type { SupplierGroup } from "@/lib/suppliers/adapter";
import { addSupplierItemToCart } from "@/lib/cart/client";
import { flyToCart } from "@/lib/cart/fly-to-cart";
import { getVegaName } from "@/lib/vega-names";
import SupplierGroupListItem from "@/components/Items/SupplierGroupListItem";
import { seedProductImageCache } from "@/lib/hooks/useProductImage";

/** Статичный «шелл» карточки, отрендеренный на сервере (RSC) — попадает в первый HTML. */
export interface ProductShell {
  article: string;
  brand: string | null;
  name: string | null;
  imageUrl: string | null;
  /** Офферы из локального каталога — сеют цену/наличие в первый HTML (null, если товара нет локально). */
  group: SupplierGroup | null;
}

/**
 * Ключ оффера БЕЗ цены (склад/поставщик) — чтобы при замене сид→живые данные
 * сохранить выбор пользователя, даже если живая цена отличается от сидированной.
 */
function offerKey(o: BergOffer): string {
  return o.warehouse?.name || o.supplier || "";
}

interface Characteristic {
  key: string;
  value: string;
}

interface OriginalItem {
  code: string;
  brand: string;
}

function groupToBergResource(g: SupplierGroup): BergResource {
  const offers: BergOffer[] = g.offers.map((o) => ({
    price: o.ourPrice,
    quantity: o.stock,
    available_more: false,
    reliability: 90,
    multiplication_factor: 1,
    average_period: o.deliveryDays ?? 0,
    assured_period: o.deliveryDays ?? 0,
    delivery_type: 1,
    is_transit: false,
    warehouse: { id: 0, name: getVegaName(o.supplierCode), type: 1 },
    supplier: o.supplier,
  }));
  return {
    id: 0,
    name: g.name,
    article: g.article,
    brand: { id: 0, name: g.brand },
    offers,
  };
}

export default function ProductClient({
  article,
  brand,
  shell,
}: {
  article: string;
  brand: string;
  shell: ProductShell;
}) {
  const productId = article;

  // Сид из локального каталога (RSC-шелл): цена/наличие/офферы — в первом HTML.
  // Живой опрос ниже ПЕРЕЗАПИШЕТ их свежими данными от поставщиков.
  const seedProduct = useMemo(
    () => (shell.group ? groupToBergResource(shell.group) : null),
    [shell.group]
  );

  const [product, setProduct] = useState<BergResource | null>(seedProduct);
  const [characteristics, setCharacteristics] = useState<Characteristic[]>([]);
  const [originals, setOriginals] = useState<OriginalItem[]>([]);
  const [analogs, setAnalogs] = useState<SupplierGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<BergOffer | null>(
    seedProduct?.offers?.[0] ?? null
  );
  const [offersCollapsed, setOffersCollapsed] = useState(false);
  const [showAllOffers, setShowAllOffers] = useState(false);
  // Пользовательская сортировка предложений (клик по заголовку / пилюле).
  const [sortKey, setSortKey] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  // Оффер, с которого переключились на «есть дешевле» — чтобы вернуться к нему
  // (к быстрой доставке) одной кнопкой.
  const [prevOffer, setPrevOffer] = useState<BergOffer | null>(null);

  const router = useRouter();

  // «Назад» возвращает туда, откуда пришёл (список цен по артикулу, результаты
  // поиска, VIN-каталог), а не в общий каталог — иначе после мисклика на
  // карточку приходится заново вводить VIN и искать деталь. Fallback на /catalog,
  // если истории нет (прямой заход по ссылке / новая вкладка).
  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/catalog");
    }
  };

  // При переходе на другой товар — сбросить на новый сид, пока грузятся живые
  // данные (иначе на экране осталась бы цена предыдущего товара).
  useEffect(() => {
    setProduct(seedProduct);
    setSelectedOffer(seedProduct?.offers?.[0] ?? null);
    setPrevOffer(null);
  }, [seedProduct]);

  useEffect(() => {
    if (productId) {
      loadProduct();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, brand]);

  const loadProduct = async () => {
    setLoading(true);
    setError(null);

    try {
      const url = `/api/product/${encodeURIComponent(productId)}${
        brand ? `?brand=${encodeURIComponent(brand)}` : ""
      }`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Товар не найден");
      }

      const data: {
        group: SupplierGroup | null;
        characteristics: Characteristic[];
        originals: OriginalItem[];
        analogs: SupplierGroup[];
      } = await res.json();

      if (!data.group) {
        setError("Товар не найден");
        return;
      }

      const resource = groupToBergResource(data.group);
      setProduct(resource);
      setCharacteristics(data.characteristics || []);
      setOriginals(data.originals || []);

      // Сервер уже подмешал готовые URL картинок в аналоги (enrichGroupsWithImages).
      // Засеваем in-memory cache до монтирования карточек — тогда ProductImage
      // в каждом аналоге найдёт URL мгновенно и не пойдёт в /api/product-image.
      const analogGroups = data.analogs || [];
      for (const g of analogGroups) {
        if (g.imageUrl !== undefined) {
          seedProductImageCache(g.brand, g.article, g.imageUrl);
        }
      }
      setAnalogs(analogGroups);

      if (resource.offers && resource.offers.length > 0) {
        // Офферы уже отсортированы «в наличии → быстрее → дешевле».
        // Если пользователь уже выбрал оффер на сид-данных — сохраняем выбор по
        // складу/поставщику (ключ без цены, чтобы пережить смену цены сид→живые);
        // иначе берём лучший (первый).
        const liveOffers = resource.offers;
        setSelectedOffer((prev) => {
          if (prev) {
            const k = offerKey(prev);
            const match = liveOffers.find((o) => offerKey(o) === k);
            if (match) return match;
          }
          return liveOffers[0];
        });
      }
    } catch (err: any) {
      console.error("Product load error:", err);
      setError(err.message || "Не удалось загрузить товар");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async (e: React.MouseEvent) => {
    if (!product || !selectedOffer) return;
    flyToCart(e.currentTarget as HTMLElement);
    try {
      await addSupplierItemToCart({
        article: product.article,
        brand: product.brand?.name || "",
        name: product.name,
        ourPrice: selectedOffer.price,
        supplierPrice: selectedOffer.price,
        stock: selectedOffer.quantity,
        deliveryDays: selectedOffer.average_period,
        supplier: selectedOffer.supplier,
      });
    } catch (err: any) {
      window.dispatchEvent(
        new CustomEvent("cart:error", {
          detail: { message: err?.message || "Не удалось добавить" },
        })
      );
    }
  };

  // Товара нет совсем (и сервер не дал шелл, и живой опрос не нашёл) — страница ошибки.
  if (error && !product && !shell.name) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <div className="bg-neutral-900 border border-red-500/30 rounded-2xl p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Ошибка</h2>
          <p className="text-neutral-400 mb-6">{error || "Товар не найден"}</p>
          <Link href="/">
            <Button>Вернуться на главную</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Отображаемые поля: пока живой опрос идёт — берём из серверного шелла,
  // после загрузки — из живого ответа поставщиков.
  const displayBrand =
    product?.brand?.name || shell.brand || "Неизвестный бренд";
  const displayName = product?.name || shell.name || productId;
  const imageBrand = shell.brand || brand || product?.brand?.name || "";

  const totalStock =
    product?.offers?.reduce((sum, offer) => sum + offer.quantity, 0) || 0;
  const minPrice = product?.offers?.length
    ? Math.min(...product.offers.map((o) => o.price))
    : null;

  // Заголовочная цена = цена ВЫБРАННОГО оффера (та, что уйдёт в корзину), чтобы
  // «карточка == корзина» при любом выборе. minPrice — только fallback, пока
  // оффер не выбран, и для подсказки «есть дешевле» ниже.
  const displayPrice = selectedOffer?.price ?? minPrice;

  // Самый дешёвый оффер: список отсортирован «в наличии → быстрее → дешевле»,
  // поэтому дешёвый может оказаться вне топ-3 — всегда показываем его рядом с
  // тремя лучшими, и на него ведёт подсказка «есть дешевле — от X ₽».
  const cheapestOffer = product?.offers?.length
    ? product.offers.reduce(
        (m, o) => (o.price < m.price ? o : m),
        product.offers[0]
      )
    : null;
  // Сортированный список (или дефолтный порядок сервера, если sortKey=null).
  const sortedOffers = sortOffers(product?.offers ?? [], sortKey, sortDir);
  let visibleOffers = sortedOffers;
  if (!showAllOffers) {
    visibleOffers = sortedOffers.slice(0, 3);
    // В дефолтном порядке всегда показываем самый дешёвый рядом с топ-3. При
    // активной сортировке порядок задаёт пользователь — не вмешиваемся.
    if (!sortKey && cheapestOffer && !visibleOffers.includes(cheapestOffer)) {
      visibleOffers = [...visibleOffers, cheapestOffer];
    }
  }

  // Клик по заголовку/пилюле: тот же столбец → переключить направление,
  // другой → выбрать его с дефолтным направлением.
  function toggleSort(key: SortField, defaultDir: "asc" | "desc") {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(defaultDir);
    }
  }
  const sortIcon = (key: SortField) =>
    sortKey === key ? (
      sortDir === "asc" ? (
        <ChevronUp className="w-3.5 h-3.5 text-orange-400" />
      ) : (
        <ChevronDown className="w-3.5 h-3.5 text-orange-400" />
      )
    ) : (
      <ChevronsUpDown className="w-3.5 h-3.5 text-neutral-600" />
    );

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumbs */}
        <div className="mb-6">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center text-orange-500 hover:text-orange-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад
          </button>
        </div>

        {/* Product Details — шелл (бренд/название/фото) отдаётся сервером сразу */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden mb-8">
          {/* Заголовок: бренд + название — сразу видно (особенно на мобилке) */}
          <div className="px-6 pt-6 md:px-8 md:pt-8">
            <div className="inline-block px-3 py-1 bg-orange-500/20 border border-orange-500/30 rounded-lg mb-3">
              <span className="text-sm text-orange-400 font-semibold">
                {displayBrand}
              </span>
            </div>
            <h1
              className={`text-2xl md:text-3xl font-bold text-white leading-tight transition-opacity duration-300 ${
                loading && product ? "opacity-80" : "opacity-100"
              }`}
            >
              {displayName}
            </h1>
          </div>
          <div className="grid md:grid-cols-2 gap-6 md:gap-8 p-6 md:p-8 md:pt-5">
            {/* Картинка — LCP первого экрана: priority + готовый URL из шелла */}
            <ProductImage
              brand={imageBrand}
              article={productId}
              alt={displayName || "Фото товара"}
              className="w-full h-[220px] sm:h-[320px] md:h-[min(46vh,440px)] rounded-2xl"
              innerPadding="p-4 md:p-8"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
              initialUrl={shell.imageUrl}
            />

            {/* Покупка: цена + кнопка сразу, ниже — наличие/гарантия/описание */}
            <div className="space-y-5">
              {/* Price — скелетон только если данных ещё нет (нет сида и идёт загрузка) */}
              {!product && loading ? (
                <div className="bg-neutral-800/50 border border-neutral-700/50 rounded-2xl p-5 md:p-6">
                  <div className="h-4 w-16 bg-neutral-700 rounded animate-pulse mb-3" />
                  <div className="h-9 w-40 bg-neutral-700 rounded animate-pulse" />
                </div>
              ) : minPrice ? (
                <div className="bg-gradient-to-r from-orange-500/20 to-orange-600/10 border border-orange-500/30 rounded-2xl p-5 md:p-6">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="text-sm text-neutral-400">Цена</div>
                    {/* Пока идёт живой опрос поставщиков — показываем, что цифры
                        предварительные и уточняются (а не «глючат»). */}
                    {loading && product && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-orange-300/90">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                        обновляем цену и наличие…
                      </span>
                    )}
                  </div>
                  <div
                    className={`text-4xl font-bold text-white transition-opacity duration-300 ${
                      loading && product ? "opacity-60" : "opacity-100"
                    }`}
                  >
                    {(displayPrice ?? minPrice)!.toLocaleString("ru-RU")}{" "}
                    <span className="text-xl text-neutral-400">₽</span>
                  </div>
                  {/* Подсказка про более дешёвый вариант — только когда выбранный
                      оффер дороже минимума. Клик выбирает самый дешёвый оффер:
                      заголовочная цена и корзина сразу станут этим минимумом. */}
                  {minPrice != null &&
                    displayPrice != null &&
                    minPrice < displayPrice &&
                    cheapestOffer &&
                    selectedOffer && (
                      <button
                        type="button"
                        onClick={() => {
                          setPrevOffer(selectedOffer);
                          setSelectedOffer(cheapestOffer);
                        }}
                        className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-left text-sm text-orange-400 hover:text-orange-300 transition-colors"
                      >
                        <span>
                          есть дешевле — от {minPrice.toLocaleString("ru-RU")} ₽
                        </span>
                        {/* Честный компромисс: дешёвый оффер обычно едет дольше —
                            показываем на сколько дней и какой будет срок. */}
                        {cheapestOffer.average_period >
                          selectedOffer.average_period && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-400/90">
                            <Clock className="w-3 h-3 shrink-0" />
                            но доставка дольше на{" "}
                            {cheapestOffer.average_period -
                              selectedOffer.average_period}{" "}
                            дн. ({formatDeliveryDays(cheapestOffer.average_period)})
                          </span>
                        )}
                      </button>
                    )}

                  {/* После переключения на дешёвый-но-долгий — кнопка вернуться к
                      прежнему (быстрому) офферу одним кликом. */}
                  {selectedOffer &&
                    cheapestOffer &&
                    selectedOffer === cheapestOffer &&
                    prevOffer &&
                    prevOffer !== cheapestOffer && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOffer(prevOffer);
                          setPrevOffer(null);
                        }}
                        className="mt-2 inline-flex items-center gap-1.5 text-sm text-neutral-300 hover:text-white transition-colors"
                      >
                        <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                        вернуть как было — {prevOffer.price.toLocaleString("ru-RU")} ₽,{" "}
                        {formatDeliveryDays(prevOffer.average_period)}
                      </button>
                    )}
                </div>
              ) : (
                <div className="bg-neutral-800/50 border border-neutral-700/50 rounded-2xl p-5 md:p-6">
                  <div className="text-sm text-neutral-400 mb-1">Цена</div>
                  <div className="text-2xl font-bold text-neutral-300">
                    По запросу
                  </div>
                </div>
              )}

              {/* Add to Cart */}
              <Button
                onClick={handleAddToCart}
                disabled={!selectedOffer || totalStock === 0}
                size="xl"
                className="w-full"
              >
                <ShoppingCart className="w-5 h-5" />
                Добавить в корзину
              </Button>

              {/* Stock Status */}
              <div className="flex items-center gap-4">
                {!product && loading ? (
                  <div className="h-10 w-44 bg-neutral-800 border border-neutral-700 rounded-xl animate-pulse" />
                ) : totalStock > 0 ? (
                  <div
                    className={`flex items-center gap-2 text-green-400 bg-green-500/10 border border-green-500/30 px-4 py-2 rounded-xl transition-opacity duration-300 ${
                      loading && product ? "opacity-60" : "opacity-100"
                    }`}
                  >
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-semibold">
                      В наличии: {totalStock} шт.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-neutral-400 bg-neutral-800 border border-neutral-700 px-4 py-2 rounded-xl">
                    <Clock className="w-5 h-5" />
                    <span className="font-semibold">Под заказ</span>
                  </div>
                )}
              </div>

              {/* Features */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3 bg-neutral-800/50 border border-neutral-700/50 rounded-xl p-3">
                  <Shield className="w-5 h-5 text-orange-500" />
                  <span className="text-sm text-neutral-400">Гарантия</span>
                </div>
                <div className="flex items-center gap-3 bg-neutral-800/50 border border-neutral-700/50 rounded-xl p-3">
                  <Truck className="w-5 h-5 text-orange-500 shrink-0" />
                  <span className="text-sm text-neutral-400">
                    Доставка
                    {selectedOffer && (
                      <span className="text-white font-medium">
                        {" · "}
                        {formatDeliveryDays(selectedOffer.average_period)}
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Article */}
              <div className="flex items-center gap-2">
                <span className="text-neutral-500">Артикул:</span>
                <span className="font-mono font-bold text-lg text-white bg-neutral-800 px-3 py-1 rounded-lg">
                  {productId}
                </span>
              </div>

              {/* Description */}
              <div className="border-t border-neutral-800 pt-5">
                <h3 className="font-semibold text-white mb-2">Описание</h3>
                <p className="text-neutral-400">{displayName}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Offers Table */}
        {product?.offers && product.offers.length > 0 && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden mb-8">
            <button
              type="button"
              onClick={() => setOffersCollapsed((v) => !v)}
              className={`w-full px-6 py-4 flex items-center justify-between hover:bg-neutral-800/30 transition-colors ${
                offersCollapsed ? "" : "border-b border-neutral-800"
              }`}
              aria-expanded={!offersCollapsed}
            >
              <h2 className="text-xl font-bold text-white">Предложения</h2>
              <ChevronDown
                className={`w-5 h-5 text-neutral-400 transition-transform duration-200 ${
                  offersCollapsed ? "" : "rotate-180"
                }`}
              />
            </button>
            {!offersCollapsed && (
              <>
                {/* Mobile: панель сортировки (пилюли) */}
                {product.offers.length > 1 && (
                  <div className="md:hidden flex items-center gap-2 px-4 py-3 border-b border-neutral-800 overflow-x-auto">
                    <span className="text-xs text-neutral-500 shrink-0">
                      Сортировать:
                    </span>
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => toggleSort(opt.key, opt.defaultDir)}
                        className={`shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          sortKey === opt.key
                            ? "bg-orange-500/15 border-orange-500/40 text-orange-300"
                            : "bg-neutral-800 border-neutral-700 text-neutral-300"
                        }`}
                      >
                        {opt.label}
                        {sortKey === opt.key &&
                          (sortDir === "asc" ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          ))}
                      </button>
                    ))}
                  </div>
                )}

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-neutral-800">
                  {visibleOffers.map((offer, index) => (
                    <div
                      key={index}
                      className={`p-4 ${selectedOffer === offer ? "bg-orange-500/10" : ""}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-neutral-500" />
                          <span className="text-sm text-neutral-300">
                            {offer.warehouse.name}
                          </span>
                        </div>
                        <span className="text-base font-bold text-white">
                          {offer.price.toLocaleString("ru-RU")} ₽
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-neutral-400 mb-3">
                        <span>{offer.quantity} шт.</span>
                        <span>{formatDeliveryDays(offer.average_period)}</span>
                        <span className="inline-flex items-center gap-1">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              offer.reliability >= 90
                                ? "bg-green-500"
                                : offer.reliability >= 70
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                            }`}
                          />
                          {offer.reliability}%
                        </span>
                      </div>
                      <button
                        onClick={() => setSelectedOffer(offer)}
                        className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all ${
                          selectedOffer === offer
                            ? "bg-orange-500 text-white"
                            : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700 border border-neutral-700"
                        }`}
                      >
                        {selectedOffer === offer ? "Выбрано" : "Выбрать"}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-neutral-800/50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                          Склад
                        </th>
                        <th className="px-6 py-4 text-left">
                          <button
                            type="button"
                            onClick={() => toggleSort("quantity", "desc")}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-400 uppercase tracking-wider hover:text-white transition-colors"
                          >
                            Количество
                            {sortIcon("quantity")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left">
                          <button
                            type="button"
                            onClick={() => toggleSort("price", "asc")}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-400 uppercase tracking-wider hover:text-white transition-colors"
                          >
                            Цена
                            {sortIcon("price")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left">
                          <button
                            type="button"
                            onClick={() => toggleSort("delivery", "asc")}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-400 uppercase tracking-wider hover:text-white transition-colors"
                          >
                            Срок
                            {sortIcon("delivery")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left">
                          <button
                            type="button"
                            onClick={() => toggleSort("reliability", "desc")}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-400 uppercase tracking-wider hover:text-white transition-colors"
                          >
                            Надежность
                            {sortIcon("reliability")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                          Действие
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                      {visibleOffers.map((offer, index) => (
                        <tr
                          key={index}
                          className={`hover:bg-neutral-800/50 transition-colors ${
                            selectedOffer === offer ? "bg-orange-500/10" : ""
                          }`}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-neutral-500" />
                              <span className="text-sm text-neutral-300">
                                {offer.warehouse.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-neutral-300">
                            {offer.quantity} шт.
                            {offer.available_more && (
                              <span className="text-green-400 ml-1">+</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-white">
                            {offer.price.toLocaleString("ru-RU")} ₽
                          </td>
                          <td className="px-6 py-4 text-sm text-neutral-300">
                            {formatDeliveryDays(offer.average_period)}
                            {offer.is_transit && (
                              <span className="ml-2 text-xs text-orange-400">
                                (в пути)
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-neutral-700 rounded-full overflow-hidden w-20">
                                <div
                                  className={`h-full ${
                                    offer.reliability >= 90
                                      ? "bg-green-500"
                                      : offer.reliability >= 70
                                        ? "bg-yellow-500"
                                        : "bg-red-500"
                                  }`}
                                  style={{ width: `${offer.reliability}%` }}
                                />
                              </div>
                              <span className="text-xs text-neutral-400">
                                {offer.reliability}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => setSelectedOffer(offer)}
                              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                selectedOffer === offer
                                  ? "bg-orange-500 text-white"
                                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700 border border-neutral-700"
                              }`}
                            >
                              {selectedOffer === offer ? "Выбрано" : "Выбрать"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {product.offers.length > 3 && (
                  <button
                    onClick={() => setShowAllOffers(!showAllOffers)}
                    className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-neutral-400 hover:text-orange-400 bg-neutral-800/30 hover:bg-neutral-800/60 border-t border-neutral-800 transition-colors"
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${showAllOffers ? "rotate-180" : ""}`}
                    />
                    {showAllOffers
                      ? "Свернуть"
                      : `Показать все ${product.offers.length} предложений`}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Характеристики */}
        {characteristics.length > 0 && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-neutral-800">
              <h2 className="text-xl font-bold text-white">Характеристики</h2>
            </div>
            <div className="divide-y divide-neutral-800">
              {characteristics.map((c, i) => (
                <div
                  key={`${c.key}-${i}`}
                  className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 px-6 py-3"
                >
                  <div className="sm:w-60 shrink-0 text-sm text-neutral-400">
                    {c.key}
                  </div>
                  <div className="text-sm text-neutral-100 break-words">
                    {c.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Оригинальные OEM-номера */}
        {originals.length > 0 && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-neutral-800">
              <h2 className="text-xl font-bold text-white">
                Оригинальные номера
              </h2>
            </div>
            <div className="px-6 py-4 flex flex-wrap gap-2">
              {originals.slice(0, 40).map((o, i) => (
                <div
                  key={`${o.brand}-${o.code}-${i}`}
                  className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm"
                >
                  <span className="text-orange-500 font-semibold mr-2">
                    {o.brand}
                  </span>
                  <span className="font-mono text-white">{o.code}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Аналоги искомого бренда */}
        {analogs.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-white mb-6">
              Аналоги искомого бренда
            </h2>
            <div className="space-y-4">
              {analogs.map((g) => (
                <SupplierGroupListItem
                  key={`${g.article}-${g.brand}`}
                  group={g}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
