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
import { normalizeArticle } from "@/lib/suppliers/adapter";
import { productUrl } from "@/lib/product-url";
import { isProductInWave1 } from "@/lib/seo/product-wave";
import { findLiveProductGroup } from "@/lib/suppliers/live-product-group";

/**
 * Серверная обёртка карточки товара. Делает БЫСТРЫЙ индексный lookup в каталоге
 * (название + URL картинки + офферы из product_stocks) — без живого опроса 7
 * поставщиков — и отдаёт «шелл» прямо в первом HTML: бренд/название/LCP-фото И
 * ЦЕНУ/НАЛИЧИЕ/ПРЕДЛОЖЕНИЯ (для каталожных товаров). Живые цены/наличие/аналоги
 * client-island (ProductClient) ПЕРЕЗАПИШЕТ свежими данными опросом
 * /api/product/[article]. generateMetadata даёт нормальные SEO/OG-теги.
 */

// Один lookup на запрос, общий для generateMetadata и самой страницы.
const getShell = cache(
  async (rawArticle: string, brand: string): Promise<ProductShell> => {
    const article = decodeURIComponent(rawArticle);
    try {
      const isPriorityProduct = isProductInWave1(article, brand);
      const [localGroup, liveGroup] = await Promise.all([
        findDbProductGroup(article, brand, {
          aggregateFreshOffers: isPriorityProduct,
        }),
        isPriorityProduct
          ? findLiveProductGroup(article, brand).catch(() => null)
          : Promise.resolve(null),
      ]);
      const group = liveGroup ?? localGroup;
      if (!group) {
        return { article, brand: brand || null, name: null, imageUrl: null, group: null };
      }

      const [enriched] = await enrichGroupsWithImages([
        { brand: group.brand, article: group.article },
      ]);

      return {
        article: group.article,
        brand: group.brand || brand || null,
        name: group.name ?? null,
        imageUrl: enriched?.imageUrl ?? null,
        group,
      };
    } catch {
      return { article, brand: brand || null, name: null, imageUrl: null, group: null };
    }
  }
);

const priceFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

function getMinimumAvailablePrice(shell: ProductShell): number | null {
  const prices = (shell.group?.offers ?? [])
    .filter(
      (offer) =>
        offer.stock > 0 &&
        Number.isFinite(offer.ourPrice) &&
        offer.ourPrice > 0
    )
    .map((offer) => offer.ourPrice);

  return prices.length > 0 ? Math.min(...prices) : null;
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
  const shell = await getShell(id, brand);

  // Суффикс « | BroCar» добавляет шаблон title в layout — здесь бренд НЕ дописываем
  // (раньше дублировался: «… | Brocar | BroCar»).
  const brandPart = shell.brand ? `${shell.brand} ` : "";
  const titleBase = shell.name
    ? `${brandPart}${shell.article} — ${shell.name}`
    : `Запчасть ${shell.article}${brandPart ? ` (${shell.brand})` : ""}`;
  const minimumPrice = getMinimumAvailablePrice(shell);
  const isPriorityProduct =
    Boolean(shell.name) && isProductInWave1(shell.article, shell.brand);
  const title = isPriorityProduct
    ? [
        shell.brand,
        shell.article,
        shell.name,
        "купить в Екатеринбурге",
        minimumPrice !== null
          ? `- цена от ${priceFormatter.format(minimumPrice)} ₽`
          : null,
      ]
        .filter(Boolean)
        .join(" ")
    : titleBase;
  const description = shell.name
    ? `Купить ${shell.name} (${brandPart}артикул ${shell.article}): цена, наличие, быстрая доставка по Екатеринбургу и всей России. Заказывайте в BroCar!`
    : `Артикул ${shell.article}: цена, наличие и сроки доставки по всей России. Подбор аналогов и заказ в интернет-магазине автозапчастей BroCar.`;
  const productPath = productUrl(shell.article, shell.brand);
  const canonical = `${SITE_URL}${productPath}`;

  return {
    title,
    description,
    alternates: { canonical },
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
    canonicalBrandName = canonicalBrand(shell.brand);
    const canonicalPath = productUrl(canonicalArticle, canonicalBrandName);

    if (
      decodeURIComponent(id) !== canonicalArticle ||
      brand !== canonicalBrandName
    ) {
      permanentRedirect(canonicalPath);
    }
  }

  // Product-разметку отдаём только когда товар известен серверу (есть в каталоге):
  // название/цена/наличие — из снимка шелла. Для «живых» артикулов (данные
  // приходят клиентским опросом) разметку не выдумываем.
  const offers = shell.group?.offers ?? [];
  const price = offers.length
    ? Math.min(...offers.map((o) => o.ourPrice))
    : null;
  const inStock = offers.some((o) => o.stock > 0);
  const productPath = productUrl(canonicalArticle, canonicalBrandName);
  const preserveShellName =
    Boolean(shell.name) && isProductInWave1(canonicalArticle, canonicalBrandName);

  const crumbs = [
    { name: "Главная", href: "/" },
    { name: "Каталог", href: "/catalog" },
    { name: shell.name || shell.article, href: productPath },
  ];

  return (
    <>
      {shell.name && (
        <JsonLd
          data={productSchema({
            article: shell.article,
            brand: shell.brand,
            name: shell.name,
            image: shell.imageUrl,
            url: `${SITE_URL}${productPath}`,
            price,
            highPrice: offers.length
              ? Math.max(...offers.map((o) => o.ourPrice))
              : null,
            offerCount: offers.length,
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
      />
    </>
  );
}
