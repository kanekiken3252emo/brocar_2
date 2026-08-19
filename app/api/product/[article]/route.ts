import { NextRequest, NextResponse } from "next/server";
import {
  searchAllSuppliers,
  groupOffers,
  dedupeGroups,
  mergeFamilyGroups,
  compareGroupsByDelivery,
  normalizeArticle,
  type SupplierGroup,
  type SupplierItem,
} from "@/lib/suppliers/adapter";
import { brandKey, canonicalBrand } from "@/lib/brands/canonical.mjs";
import { brandFamilyId, sameBrandFamily } from "@/lib/brands/families.mjs";
import bergAdapter from "@/lib/suppliers/berg";
import rosskoAdapter from "@/lib/suppliers/rossko";
import shateMAdapter, {
  ShateMAdapter,
  type ShateCharacteristic,
} from "@/lib/suppliers/shate-m";
import forumAutoAdapter from "@/lib/suppliers/forum-auto";
import armtekAdapter from "@/lib/suppliers/armtek";
import autotradeAdapter from "@/lib/suppliers/autotrade";
import partKomAdapter from "@/lib/suppliers/partkom";
import { applyPricingSync } from "@/lib/pricing";
import { enrichGroupsWithImages } from "@/lib/product-images";
import { CACHE_PRODUCT } from "@/lib/http-cache";
import { findDbProductGroup } from "@/lib/suppliers/db-group";
import { withServerTiming } from "@/lib/server-timing";

interface ProductDetailResponse {
  group: SupplierGroup | null;
  characteristics: ShateCharacteristic[];
  originals: Array<{ code: string; brand: string }>;
  /** Оригиналы того же концерна под другим номером (PSA/PEUGEOT/CITROEN
   *  для 1109.AH → 9818914980, 1109.Z2). Отдельный раздел «Оригинальные замены». */
  originalReplacements: SupplierGroup[];
  /** Заменители сторонних брендов. */
  analogs: SupplierGroup[];
}

async function getHandler(
  request: NextRequest,
  { params }: { params: Promise<{ article: string }> }
) {
  try {
    const { article } = await params;
    const decoded = decodeURIComponent(article);
    const brand = request.nextUrl.searchParams.get("brand") || "";

    const adapters = [
      bergAdapter,
      rosskoAdapter,
      shateMAdapter,
      forumAutoAdapter,
      armtekAdapter,
      autotradeAdapter,
      partKomAdapter,
    ];

    // Параллельно: офферы по точному article+brand от всех + articleId в ShATE-M.
    // Таймаут 6000мс (был 10000): живая цена на карточке появляется быстрее.
    // Каждый адаптер по race отдаёт ЛИБО полный список, ЛИБО [] — частичных нет,
    // так что урезание не «портит» ответ, лишь отсекает не успевших. Быстрые
    // (Berg/ShATE-M/Forum) укладываются; для каталожных товаров цена и так уже
    // показана из локального сида (см. app/product/[id]/page.tsx).
    // Поставщиков спрашиваем БЕЗ бренда: оригинал концерна лежит под разными
    // ярлыками (CITROEN / PEUGEOT / PSA; OPEL / GM), и сужение запроса брендом
    // прятало и оригинал под другим ярлыком, и его кроссы («OPEL — 2 аналога,
    // GM — 50»). Свою группу выбираем ниже по артикулу + семейству брендов.
    const [mainItems, shateArticleId] = await Promise.all([
      searchAllSuppliers(
        adapters,
        // withCrosses: Rossko/Berg отдают и заменители — блок «Аналоги в
        // продаже» наполняется реальными кроссами, а не 1-2 позициями.
        { article: decoded, withCrosses: true },
        6000
      ).catch(() => [] as SupplierItem[]),
      (shateMAdapter as ShateMAdapter).findArticleId(decoded, brand).catch(() => null),
    ]);

    const pricing = (base: number, ctx: { brand?: string }) =>
      applyPricingSync(base, ctx);

    // Ярлыки одного концерна с одним артикулом (PSA / PEUGEOT/CITROEN /
    // Citroen) сливаются в одну группу со всеми предложениями.
    const mainGroups = mergeFamilyGroups(groupOffers(mainItems, pricing));

    // Главная группа: сверяем И артикул, И бренд. Раньше матчили только бренд
    // с фолбэком на mainGroups[0] (группы отсортированы по цене) — и на карточку
    // оригинала вставала самая дешёвая группа того же бренда: Росско под брендом
    // оригинала отдаёт свою марку T-PARTS с артикулом «<номер>TM» втрое дешевле,
    // и она подменяла название/цену/предложения оригинала (Toyota 08889-80150 —
    // аналог за 669₽ на карточке оригинала за 2400₽+). Группы с ДРУГИМ артикулом
    // главной быть не могут — они уйдут в «Аналоги» ниже.
    const wantedArticle = normalizeArticle(decoded);
    const wantedBrandKey = brand ? brandKey(canonicalBrand(brand)) : "";
    const sameArticle = mainGroups.filter((g) => g.article === wantedArticle);
    // Приоритет: точный бренд → бренд того же СЕМЕЙСТВА (CITROEN ≈ PSA ≈
    // Peugeot/Citroen — это тот же оригинал) → без брендового запроса берём
    // первую группу. Если бренд задан, но ни одна группа не из его семейства —
    // главной НЕ подменяем (чужой бренд с тем же артикулом уйдёт в аналоги).
    let mainGroup: SupplierGroup | null =
      (wantedBrandKey
        ? sameArticle.find((g) => brandKey(g.brand) === wantedBrandKey) ??
          sameArticle.find((g) => sameBrandFamily(g.brand, brand))
        : sameArticle[0]) ?? null;

    // Поставщики ничего не дали — пробуем каталог из БД (ручные/тестовые товары).
    if (!mainGroup) {
      mainGroup = await findDbProductGroup(decoded, brand).catch(() => null);
    }

    let characteristics: ShateCharacteristic[] = [];
    let originals: ProductDetailResponse["originals"] = [];
    let originalReplacements: SupplierGroup[] = [];
    let analogs: SupplierGroup[] = [];

    // Группы живого поиска, не ставшие главной (другой артикул или бренд под тем
    // же запросом — например T-PARTS-двойники Росско), — показываем как аналоги,
    // а не выбрасываем: покупатель по-прежнему видит дешёвый вариант, но честно
    // подписанный отдельной позицией.
    const analogCandidates: SupplierGroup[] = mainGroups.filter(
      (g) => g !== mainGroup
    );

    if (shateArticleId) {
      // Характеристики + офферы по аналогам одним большим запросом (с includeAnalogs)
      const [details, analogItems] = await Promise.all([
        (shateMAdapter as ShateMAdapter).getArticleDetails(shateArticleId),
        (shateMAdapter as ShateMAdapter).searchWithAnalogsById(shateArticleId),
      ]);

      characteristics = details?.extendedInfo?.characteristics ?? [];
      originals = (details?.extendedInfo?.originals ?? []).map((o) => ({
        code: o.code,
        brand: o.tradeMarkName ?? "",
      }));

      // Группируем все полученные item'ы (основной + аналоги)
      analogCandidates.push(...groupOffers(analogItems, pricing));
    }

    if (analogCandidates.length > 0) {
      // Схлопываем дубли (живой поиск и ШАТЕ-М могут вернуть один товар),
      // исключаем группу самого искомого товара — она уже в mainGroup.
      // Сортируем «в наличии → быстрее → дешевле» (срок в приоритете), чтобы
      // самые быстрые позиции (сегодня/завтра) были вверху, и берём топ-20
      // именно по скорости, а не по цене.
      // mainGroup из БД-фолбэка несёт СЫРЫЕ article/brand из products («08889-80150»,
      // «PSA») — нормализуем обе части, иначе ключ не совпадёт с нормализованными
      // группами dedupeGroups и главный товар продублируется первым «аналогом».
      // Для живых групп normalizeArticle/canonicalBrand идемпотентны.
      const mainKey = mainGroup
        ? `${normalizeArticle(mainGroup.article)}|${brandKey(canonicalBrand(mainGroup.brand))}`
        : `${wantedArticle}|${wantedBrandKey}`;
      const sortedAnalogs = mergeFamilyGroups(dedupeGroups(analogCandidates))
        .filter((g) => `${g.article}|${brandKey(g.brand)}` !== mainKey)
        .sort(compareGroupsByDelivery);
      // Оригиналы того же концерна (PSA для Citroën, GM для Opel…) под другим
      // номером — отдельный раздел «Оригинальные замены» (просьба владельца,
      // 19.08, как у Berg: «Аналоги искомого бренда»). Сторонние бренды — «Аналоги».
      // Только для брендов-ОРИГИНАЛОВ из таблицы семейств: у карточки ZOMMER
      // 1109AH «Zommer Z1109AH» — не оригинальная замена, а просто тот же бренд.
      const ownBrand = brand || mainGroup?.brand || "";
      if (ownBrand && brandFamilyId(ownBrand) !== null) {
        originalReplacements = sortedAnalogs
          .filter((g) => sameBrandFamily(g.brand, ownBrand))
          .slice(0, 20);
        analogs = sortedAnalogs
          .filter((g) => !sameBrandFamily(g.brand, ownBrand))
          .slice(0, 20);
      } else {
        analogs = sortedAnalogs.slice(0, 20);
      }

      // Подмешиваем готовые URL картинок из кэша product_images, чтобы клиент
      // засеял in-memory cache и не делал N запросов к /api/product-image на
      // карточках аналогов (см. enrichGroupsWithImages / seedProductImageCache).
      [originalReplacements, analogs] = await Promise.all([
        enrichGroupsWithImages(originalReplacements),
        enrichGroupsWithImages(analogs),
      ]);
    }

    // Засеваем картинку и для ГЛАВНОГО товара (не только аналогов) — иначе клиент
    // делает второй, медленный запрос /api/product-image за самой важной картинкой
    // экрана (LCP). enrichGroupsWithImages подставит готовый URL из кэша, если он есть.
    let enrichedMain: SupplierGroup | null = mainGroup;
    if (mainGroup) {
      const [m] = await enrichGroupsWithImages([mainGroup]);
      enrichedMain = m ?? mainGroup;
    }

    const response: ProductDetailResponse = {
      group: enrichedMain,
      characteristics,
      originals,
      originalReplacements,
      analogs,
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": CACHE_PRODUCT },
    });
  } catch (error) {
    console.error("Product detail route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const GET = withServerTiming(getHandler);
