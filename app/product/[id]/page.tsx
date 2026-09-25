import { cache } from "react";
import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { enrichGroupsWithImages } from "@/lib/product-images";
import { findDbProductGroup } from "@/lib/suppliers/db-group";
import ProductClient, { type ProductShell } from "./ProductClient";
import { JsonLd } from "@/components/seo/JsonLd";
import { SITE_URL, productSchema } from "@/lib/seo/structured-data";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { canonicalBrand } from "@/lib/brands/canonical.mjs";
import {
  limitSupplierGroupOffers,
  normalizeArticle,
  toPublicSupplierGroup,
} from "@/lib/suppliers/adapter";
import { productUrl } from "@/lib/product-url";
import {
  isProductInSeoWave,
  isProductInSeoWave5,
} from "@/lib/seo/product-wave";
import { getProductSeoSnapshot } from "@/lib/seo/product-snapshot";
import {
  buildProductSeoTitle,
  getSafeProductName,
  isUsableProductName,
} from "@/lib/suppliers/mojibake";
import {
  getProductSupplierSeed,
  pickMainProductGroup,
} from "@/lib/product-supplier-seed";

/**
 * Серверная обёртка карточки товара. Делает БЫСТРЫЙ индексный lookup в каталоге
 * (название + URL картинки + офферы из product_stocks) — без живого опроса 7
 * поставщиков — и отдаёт «шелл» прямо в первом HTML: бренд/название/LCP-фото И
 * ЦЕНУ/НАЛИЧИЕ/ПРЕДЛОЖЕНИЯ (для каталожных товаров). Живые цены/наличие/аналоги
 * client-island (ProductClient) ПЕРЕЗАПИШЕТ свежими данными опросом
 * /api/product/[article]. generateMetadata даёт нормальные SEO/OG-теги.
 */

// Один lookup на запрос, общий для generateMetadata и самой страницы.
const SEO_SHELL_DB_TIMEOUT_MS = 500;
const WAVE_5_OFFER_LIMIT = 20;

const getShell = cache(
  async (rawArticle: string, brand: string): Promise<ProductShell> => {
    const article = decodeURIComponent(rawArticle);
    try {
      const isPriorityProduct = isProductInSeoWave(article, brand);
      const isWave5Product = isProductInSeoWave5(article, brand);
      const seoSnapshot = getProductSeoSnapshot(article, brand);
      const localGroupPromise = findDbProductGroup(article, brand, {
        aggregateFreshOffers: isPriorityProduct,
        aggregateNames: true,
      }).catch(() => null);
      const liveGroupPromise = isWave5Product
        ? getProductSupplierSeed(article, brand)
            .then(({ mainGroups }) =>
              pickMainProductGroup(mainGroups, article, brand)
            )
            .catch(() => null)
        : Promise.resolve(null);
      // Для индексируемой карточки имя и минимальная цена уже есть в локальном
      // SEO-снимке. Если удалённая БД каталога отвечает медленно, не держим из-за
      // неё первый HTML: свежие предложения всё равно загрузит API на клиенте.
      const localGroup =
        seoSnapshot && !isWave5Product
          ? await Promise.race([
              localGroupPromise,
              new Promise<null>((resolve) =>
                setTimeout(() => resolve(null), SEO_SHELL_DB_TIMEOUT_MS)
              ),
            ])
          : await localGroupPromise;
      const liveGroup = await liveGroupPromise;
      // Серверный HTML использует только локальные данные. Живой опрос семи
      // поставщиков выполняет клиентский /api/product/[article]; запускать его
      // ещё раз из generateMetadata/RSC нельзя, иначе открытие карточки ждёт
      // внешний API и создаёт повторную очередь запросов Autotrade.
      const sourceGroup = liveGroup
        ? toPublicSupplierGroup(liveGroup)
        : localGroup;
      const resolvedGroup = seoSnapshot
        ? {
            ...(sourceGroup ?? {
              article: seoSnapshot.article,
              brand: seoSnapshot.brand,
              name: seoSnapshot.name,
              minPrice: seoSnapshot.minPrice ?? 0,
              maxPrice: seoSnapshot.minPrice ?? 0,
              totalStock: 0,
              minDeliveryDays: null,
              offers: [],
            }),
            article: normalizeArticle(seoSnapshot.article),
            brand: canonicalBrand(seoSnapshot.brand),
            name: seoSnapshot.name,
          }
        : sourceGroup;
      if (!resolvedGroup) {
        return {
          article,
          brand: brand || null,
          name: null,
          imageUrl: null,
          group: null,
          seoResolved: false,
          seoMinimumPrice: null,
        };
      }

      const group = isWave5Product
        ? limitSupplierGroupOffers(resolvedGroup, WAVE_5_OFFER_LIMIT)
        : resolvedGroup;

      // Если карточка существует только в SEO-снимке, не задерживаем первый HTML
      // отдельным запросом к удалённой БД картинок. ProductClient догрузит фото
      // вместе со свежими данными. Для обычной локальной карточки сохраняем
      // серверное LCP-фото из кеша.
      const [enriched] = sourceGroup
        ? await enrichGroupsWithImages([
            { brand: group.brand, article: group.article },
          ]).catch(() => [])
        : [];

      return {
        article: group.article,
        brand: group.brand || brand || null,
        name: group.name ?? null,
        imageUrl: enriched?.imageUrl ?? null,
        group,
        seoResolved: Boolean(seoSnapshot),
        seoMinimumPrice: seoSnapshot?.minPrice ?? null,
      };
    } catch {
      return {
        article,
        brand: brand || null,
        name: null,
        imageUrl: null,
        group: null,
        seoResolved: false,
        seoMinimumPrice: null,
      };
    }
  }
);

function getMinimumAvailablePrice(shell: ProductShell): number | null {
  const prices = (shell.group?.offers ?? [])
    .filter(
      (offer) =>
        offer.stock > 0 && Number.isFinite(offer.ourPrice) && offer.ourPrice > 0
    )
    .map((offer) => offer.ourPrice);

  return prices.length > 0
    ? Math.min(...prices)
    : (shell.seoMinimumPrice ?? null);
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { id } = await params;
  const sp = await searchParams;
  const brand = typeof sp.brand === "string" ? sp.brand : "";
  // getShell мемоизирован и используется также самой страницей: метатеги и H1
  // получают одну и ту же серверную идентичность товара.
  const shell = await getShell(id, brand);

  // Суффикс « | BroCar» добавляет шаблон title в layout — здесь бренд НЕ дописываем
  // (раньше дублировался: «… | Brocar | BroCar»).
  const brandPart = shell.brand ? `${shell.brand} ` : "";
  const hasUsableName = isUsableProductName(
    shell.name,
    shell.article,
    shell.brand || brand
  );
  const safeName = getSafeProductName(
    shell.name,
    shell.article,
    shell.brand || brand
  );
  const minimumPrice = getMinimumAvailablePrice(shell);
  const title = buildProductSeoTitle(
    shell.name,
    shell.article,
    shell.brand || brand,
    minimumPrice
  );
  const description = hasUsableName
    ? `Купить ${safeName} (${brandPart}артикул ${shell.article}): цена, наличие, быстрая доставка по Екатеринбургу и всей России. Заказывайте в BroCar!`
    : `Купить ${safeName}: цена, наличие и сроки доставки по Екатеринбургу и всей России. Подбор аналогов и заказ в интернет-магазине автозапчастей BroCar.`;
  // Существующий брендовый URL не переименовываем из-за объединённого ярлыка
  // поставщика (`Toyota` → `Toyota/Lexus`). Для URL важна стабильность; бренд
  // из снимка подставляем только когда исходная ссылка была совсем без бренда.
  const productPath = productUrl(shell.article, brand || shell.brand);
  const canonical = `${SITE_URL}${productPath}`;

  return {
    title,
    description,
    alternates: { canonical },
    // A supplier-only article with an explicit brand must remain indexable:
    // some real products are confirmed only by the live supplier lookup. An
    // unconfirmed brandless URL is still usable, but must not create an
    // indexable page for an arbitrary article.
    robots:
      shell.group || brand.trim()
        ? { index: true, follow: true }
        : { index: false, follow: true },
    openGraph: {
      title,
      description,
      type: "website",
      url: canonical,
      ...(shell.imageUrl ? { images: [{ url: shell.imageUrl }] } : {}),
    },
  };
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const brand = typeof sp.brand === "string" ? sp.brand : "";
  const shell = await getShell(id, brand);

  let canonicalArticle = decodeURIComponent(id);
  let canonicalBrandName = brand;

  if (shell.group) {
    canonicalArticle = normalizeArticle(shell.article);
    canonicalBrandName = canonicalBrand(brand || shell.brand);
    const canonicalPath = productUrl(canonicalArticle, canonicalBrandName);

    if (
      decodeURIComponent(id) !== canonicalArticle ||
      brand !== canonicalBrandName
    ) {
      permanentRedirect(canonicalPath);
    }
  }

  const hasUsableShellName = isUsableProductName(
    shell.name,
    shell.article,
    shell.brand || canonicalBrandName
  );
  const safeShellName = getSafeProductName(
    shell.name,
    shell.article,
    shell.brand || canonicalBrandName
  );

  // Product-разметку отдаём только когда товар известен серверу (есть в каталоге):
  // название/цена/наличие — из снимка шелла. Для «живых» артикулов (данные
  // приходят клиентским опросом) разметку не выдумываем.
  const offers = shell.group?.offers ?? [];
  // SEO-снимок уже содержит проверенную минимальную цену для карточек, где
  // локальная группа не успела загрузиться в ограничение SSR. Используем её и
  // в JSON-LD, но не заявляем наличие, пока сервер не получил офферы.
  const price = getMinimumAvailablePrice(shell);
  const highPrice = offers.length
    ? Math.max(...offers.map((o) => o.ourPrice))
    : price;
  const inStock = offers.length
    ? offers.some((offer) => offer.stock > 0)
    : null;
  const productPath = productUrl(canonicalArticle, canonicalBrandName);
  // Если сервер уже определил товар, его идентичность (бренд + название) остаётся
  // единой для H1, title, хлебных крошек и JSON-LD. Клиентский опрос обновляет
  // только коммерческие данные: цену, наличие, срок и список предложений.
  const preserveShellName = Boolean(shell.group);
  const offerLimitPilot = isProductInSeoWave5(
    canonicalArticle,
    canonicalBrandName
  );

  const crumbs = [
    { name: "Главная", href: "/" },
    { name: "Каталог", href: "/catalog" },
    { name: safeShellName, href: productPath },
  ];

  return (
    <>
      {hasUsableShellName && (
        <JsonLd
          data={productSchema({
            article: shell.article,
            brand: shell.brand,
            name: safeShellName,
            image: shell.imageUrl,
            url: `${SITE_URL}${productPath}`,
            price,
            highPrice,
            offerCount: offers.length || undefined,
            inStock,
          })}
        />
      )}
      <div className="container mx-auto px-4 pt-6">
        <Breadcrumbs items={crumbs} />
      </div>
      <ProductClient
        article={canonicalArticle}
        brand={canonicalBrandName}
        shell={shell}
        preserveShellName={preserveShellName}
        offerLimitPilot={offerLimitPilot}
      />
    </>
  );
}
