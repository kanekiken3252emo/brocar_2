import { cache } from "react";
import type { Metadata } from "next";
import { and, ilike } from "drizzle-orm";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { enrichGroupsWithImages } from "@/lib/product-images";
import ProductClient, { type ProductShell } from "./ProductClient";

/**
 * Серверная обёртка карточки товара. Делает БЫСТРЫЙ индексный lookup в каталоге
 * (название + URL картинки) — без живого опроса 7 поставщиков — и отдаёт «шелл»
 * (бренд/название/LCP-фото) прямо в первом HTML. Живые цены/наличие/аналоги
 * догружает клиент (ProductClient) опросом /api/product/[article]. Так у нового
 * пользователя нет полноэкранного спиннера и пустого экрана: каркас и главное
 * фото видны сразу (и их видят поисковики), а generateMetadata даёт нормальные
 * SEO/OG-теги вместо дженерика.
 */

// Один lookup на запрос, общий для generateMetadata и самой страницы.
const getShell = cache(
  async (rawArticle: string, brand: string): Promise<ProductShell> => {
    const article = decodeURIComponent(rawArticle);
    try {
      const conds = [ilike(products.article, article)];
      if (brand) conds.push(ilike(products.brand, brand));

      const rows = await db
        .select({
          name: products.name,
          brand: products.brand,
          article: products.article,
        })
        .from(products)
        .where(and(...conds))
        .limit(1);

      const p = rows[0];
      if (!p) {
        return { article, brand: brand || null, name: null, imageUrl: null };
      }

      const [enriched] = await enrichGroupsWithImages([
        { brand: p.brand ?? brand ?? "", article: p.article },
      ]);

      return {
        article: p.article,
        brand: p.brand ?? brand ?? null,
        name: p.name ?? null,
        imageUrl: enriched?.imageUrl ?? null,
      };
    } catch {
      return { article, brand: brand || null, name: null, imageUrl: null };
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

  const brandPart = shell.brand ? `${shell.brand} ` : "";
  const title = shell.name
    ? `${brandPart}${shell.article} — ${shell.name} | Brocar`
    : `Запчасть ${shell.article}${brandPart ? ` (${shell.brand})` : ""} | Brocar`;
  const description = shell.name
    ? `${shell.name}. ${brandPart}артикул ${shell.article} — цена, наличие и доставка автозапчастей в Brocar.`
    : `Артикул ${shell.article} — цена, наличие и доставка автозапчастей в Brocar.`;

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

  return (
    <ProductClient article={decodeURIComponent(id)} brand={brand} shell={shell} />
  );
}
