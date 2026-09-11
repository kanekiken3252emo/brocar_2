import {
  getIndexableProductCount,
  getProductSitemapCount,
} from "@/lib/seo/product-sitemaps";

export const revalidate = 86_400;

function baseUrl(): string {
  const siteDomain = process.env.NEXT_PUBLIC_SITE_DOMAIN || "localhost:3000";
  return siteDomain.startsWith("localhost")
    ? `http://${siteDomain}`
    : `https://${siteDomain}`;
}

export async function GET() {
  const host = baseUrl();
  const productCount = await getIndexableProductCount();
  const sitemapCount = getProductSitemapCount(productCount);
  const lastModified = new Date().toISOString();

  const locations = [
    `${host}/sitemap.xml`,
    ...Array.from(
      { length: sitemapCount },
      (_, id) => `${host}/sitemaps/products/${id}`
    ),
  ];

  const entries = locations
    .map(
      (location) =>
        `<sitemap><loc>${location}</loc><lastmod>${lastModified}</lastmod></sitemap>`
    )
    .join("");

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    entries +
    "</sitemapindex>";

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
    },
  });
}
