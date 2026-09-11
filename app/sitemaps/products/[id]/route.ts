import { productUrl } from "@/lib/product-url";
import {
  getIndexableProducts,
  PRODUCT_SITEMAP_PAGE_SIZE,
} from "@/lib/seo/product-sitemaps";

export const revalidate = 86_400;

function baseUrl(): string {
  const siteDomain = process.env.NEXT_PUBLIC_SITE_DOMAIN || "localhost:3000";
  return siteDomain.startsWith("localhost")
    ? `http://${siteDomain}`
    : `https://${siteDomain}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const id = Number(rawId);

  if (!Number.isInteger(id) || id < 0) {
    return new Response("Not found", { status: 404 });
  }

  const products = await getIndexableProducts();
  const offset = id * PRODUCT_SITEMAP_PAGE_SIZE;

  if (offset >= products.length) {
    return new Response("Not found", { status: 404 });
  }

  const rows = products.slice(offset, offset + PRODUCT_SITEMAP_PAGE_SIZE);
  const host = baseUrl();
  const urls = rows
    .map(
      (row) =>
        `<url><loc>${escapeXml(`${host}${productUrl(row.article, row.brand)}`)}</loc>` +
        `<lastmod>${row.lastModified.toISOString()}</lastmod>` +
        "<changefreq>daily</changefreq><priority>0.6</priority></url>"
    )
    .join("");

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    urls +
    "</urlset>";

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
    },
  });
}
