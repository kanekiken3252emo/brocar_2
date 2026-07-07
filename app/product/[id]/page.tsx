import { cache } from "react";
import type { Metadata } from "next";
import { enrichGroupsWithImages } from "@/lib/product-images";
import { findDbProductGroup } from "@/lib/suppliers/db-group";
import ProductClient, { type ProductShell } from "./ProductClient";
import { JsonLd } from "@/components/seo/JsonLd";
import { SITE_URL, productSchema } from "@/lib/seo/structured-data";
import { Breadcrumbs } from "@/components/Breadcrumbs";

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
      const group = await findDbProductGroup(article, brand);
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
  const title = shell.name
    ? `${brandPart}${shell.article} — ${shell.name}`
    : `Запчасть ${shell.article}${brandPart ? ` (${shell.brand})` : ""}`;
  const description = shell.name
    ? `Купить ${shell.name} (${brandPart}артикул ${shell.article}): цена, наличие, быстрая доставка по Екатеринбургу и всей России. Заказывайте в BroCar!`
    : `Артикул ${shell.article}: цена, наличие и сроки доставки по всей России. Подбор аналогов и заказ в интернет-магазине автозапчастей BroCar.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
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

  // Product-разметку отдаём только когда товар известен серверу (есть в каталоге):
  // название/цена/наличие — из снимка шелла. Для «живых» артикулов (данные
  // приходят клиентским опросом) разметку не выдумываем.
  const offers = shell.group?.offers ?? [];
  const price = offers.length
    ? Math.min(...offers.map((o) => o.ourPrice))
    : null;
  const inStock = offers.some((o) => o.stock > 0);
  const productPath = `/product/${encodeURIComponent(shell.article)}${
    shell.brand ? `?brand=${encodeURIComponent(shell.brand)}` : ""
  }`;

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
        article={decodeURIComponent(id)}
        brand={brand}
        shell={shell}
      />
    </>
  );
}
