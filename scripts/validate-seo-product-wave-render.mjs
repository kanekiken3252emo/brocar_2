import { readFile } from "node:fs/promises";

const baseUrl = String(process.argv[2] || "").replace(/\/$/, "");
const manifestPath = process.argv[3];
const concurrency = Number(process.argv[4] || 12);

if (!baseUrl || !manifestPath) {
  throw new Error(
    "Usage: node scripts/validate-seo-product-wave-render.mjs <base-url> <manifest.json> [concurrency]"
  );
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const products = Array.isArray(manifest.products) ? manifest.products : [];
const queue = [...products];
const failures = [];
let checked = 0;

const decodeHtml = (value) =>
  String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, "\u00a0")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();

const capture = (html, expression) => {
  const match = html.match(expression);
  return match ? decodeHtml(match[1]) : "";
};

const attributeValue = (tag, attribute) => {
  const match = tag.match(
    new RegExp(`${attribute}=(["'])([\\s\\S]*?)\\1`, "i")
  );
  return match ? decodeHtml(match[2]) : "";
};

const metaContent = (html, name) => {
  const tag = html.match(
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]*>`, "i")
  )?.[0];
  return tag ? attributeValue(tag, "content") : "";
};

const canonicalHref = (html) => {
  const tag = html.match(
    /<link[^>]+rel=["']canonical["'][^>]*>/i
  )?.[0];
  return tag ? attributeValue(tag, "href") : "";
};

async function inspect(product) {
  const path = `/product/${encodeURIComponent(product.article)}?brand=${encodeURIComponent(product.brand)}`;
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "user-agent": "BroCar-SEO-render-validator/1.0" },
    signal: AbortSignal.timeout(30000),
  });
  const html = await response.text();
  const lower = html.toLowerCase();
  const title = capture(html, /<title>([\s\S]*?)<\/title>/i);
  const h1 = capture(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const description = metaContent(html, "description");
  const canonical = canonicalHref(html);
  const titleCount = (html.match(/<title>/gi) || []).length;
  const h1Count = (html.match(/<h1\b/gi) || []).length;
  const titleIndex = lower.indexOf("<title");
  const descriptionIndex = lower.indexOf('<meta name="description"');
  const canonicalIndex = lower.indexOf('<link rel="canonical"');
  const headEndIndex = lower.indexOf("</head>");
  const bodyIndex = lower.indexOf("<body");
  const price = new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(product.seoMinPrice);
  const expectedTitle = `${product.seoBrand} ${product.article} ${h1} купить в Екатеринбурге - цена от ${price} ₽ | BroCar`.replace(
    /\s+/g,
    " "
  );
  const expectedDescription =
    `Купить ${h1} (${product.seoBrand} артикул ${product.article}): ` +
    "цена, наличие, быстрая доставка по Екатеринбургу и всей России. " +
    "Заказывайте в BroCar!";
  const expectedCanonical = `https://brocarparts.ru${path}`;

  const errors = [];
  if (response.status !== 200) errors.push(`status=${response.status}`);
  if (titleCount !== 1) errors.push(`titleCount=${titleCount}`);
  if (h1Count !== 1) errors.push(`h1Count=${h1Count}`);
  if (!h1) errors.push("empty H1");
  if (title !== expectedTitle) {
    errors.push(`title mismatch: ${JSON.stringify(title)}`);
  }
  if (description !== expectedDescription) {
    errors.push(`description mismatch: ${JSON.stringify(description)}`);
  }
  if (canonical !== expectedCanonical) {
    errors.push(`canonical mismatch: ${JSON.stringify(canonical)}`);
  }
  if (!(titleIndex >= 0 && titleIndex < headEndIndex && titleIndex < bodyIndex)) {
    errors.push(
      `title outside initial head: title=${titleIndex}, headEnd=${headEndIndex}, body=${bodyIndex}`
    );
  }
  if (
    !(
      descriptionIndex >= 0 &&
      descriptionIndex < headEndIndex &&
      descriptionIndex < bodyIndex
    )
  ) {
    errors.push(
      `description outside initial head: description=${descriptionIndex}, headEnd=${headEndIndex}, body=${bodyIndex}`
    );
  }
  if (
    !(
      canonicalIndex >= 0 &&
      canonicalIndex < headEndIndex &&
      canonicalIndex < bodyIndex
    )
  ) {
    errors.push(
      `canonical outside initial head: canonical=${canonicalIndex}, headEnd=${headEndIndex}, body=${bodyIndex}`
    );
  }

  if (errors.length) failures.push({ path, errors });
  checked += 1;
  if (checked % 100 === 0 || checked === products.length) {
    console.log(`Checked ${checked}/${products.length}; failures ${failures.length}`);
  }
}

await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      const product = queue.shift();
      if (!product) break;
      try {
        await inspect(product);
      } catch (error) {
        failures.push({
          path: `/product/${product.article}?brand=${product.brand}`,
          errors: [String(error)],
        });
        checked += 1;
      }
    }
  })
);

console.log(
  JSON.stringify(
    {
      products: products.length,
      checked,
      failures: failures.length,
      failureExamples: failures.slice(0, 20),
    },
    null,
    2
  )
);

if (failures.length) process.exitCode = 1;
