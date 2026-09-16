import { readFile, writeFile } from "node:fs/promises";

import { brandKey, canonicalBrand } from "../lib/brands/canonical.mjs";
import { familyDisplayName } from "../lib/brands/families.mjs";

const manifestPath = process.argv[2];
const auditPath = process.argv[3];
const expectedCount = Number(process.argv[4]);

if (!manifestPath || !auditPath || !Number.isInteger(expectedCount)) {
  throw new Error(
    "Usage: node scripts/enrich-seo-product-wave.mjs <manifest.json> <selection-audit.json> <expected-count>"
  );
}

const normalizeArticle = (value) =>
  String(value || "")
    .replace(/[^0-9A-Za-zА-Яа-я]/g, "")
    .toUpperCase();

const identity = (article, brand) =>
  `${normalizeArticle(article)}|${brandKey(canonicalBrand(brand))}`;

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const audit = JSON.parse(await readFile(auditPath, "utf8"));
const evidence = Array.isArray(audit.selectedEvidence)
  ? audit.selectedEvidence
  : [];

if (
  !Array.isArray(manifest.products) ||
  manifest.products.length !== expectedCount
) {
  throw new Error(`Manifest must contain exactly ${expectedCount} products`);
}
if (evidence.length !== manifest.products.length) {
  throw new Error(
    `Selection audit mismatch: ${evidence.length} evidence rows for ${manifest.products.length} products`
  );
}

const evidenceByKey = new Map(
  evidence.map((item) => [identity(item.article, item.brand), item])
);

function cleanName(rawName, article, brand) {
  let value = String(rawName || "").trim();
  const brandPrefix = `${brand} `;
  if (
    value
      .toLocaleLowerCase("ru-RU")
      .startsWith(brandPrefix.toLocaleLowerCase("ru-RU"))
  ) {
    const remainder = value.slice(brandPrefix.length).trim();
    const firstToken = remainder.match(/^(\S+)\s+([\s\S]+)$/);
    if (
      firstToken &&
      normalizeArticle(firstToken[1]) === normalizeArticle(article)
    ) {
      value = firstToken[2].trim();
    }
  }
  return value
    .replace(/КОЛЬЦОRING/gi, "КОЛЬЦО RING")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function assertUsableName(name, article, brand, key) {
  const normalized = name.toLocaleLowerCase("ru-RU");
  const normalizedArticle =
    normalizeArticle(article).toLocaleLowerCase("ru-RU");
  const normalizedBrand = canonicalBrand(brand).toLocaleLowerCase("ru-RU");
  if (!name || name.length < 3 || name.length > 220) {
    throw new Error(`Invalid SEO name for ${key}: ${name}`);
  }
  if (name.includes("�") || /(?:Р.|С.){4,}/.test(name)) {
    throw new Error(`Broken encoding in SEO name for ${key}: ${name}`);
  }
  if (normalized === normalizedArticle || normalized === normalizedBrand) {
    throw new Error(`Uninformative SEO name for ${key}: ${name}`);
  }
}

manifest.products = manifest.products.map((item) => {
  const key = identity(item.article, item.brand);
  const source = evidenceByKey.get(key);
  if (!source) throw new Error(`Missing SEO evidence for ${key}`);

  const seoName = cleanName(source.name, item.article, item.brand);
  const seoMinPrice = Number(source.price);
  const seoBrand =
    familyDisplayName(item.brand) || canonicalBrand(item.brand) || item.brand;

  assertUsableName(seoName, item.article, item.brand, key);
  if (!Number.isFinite(seoMinPrice) || seoMinPrice <= 0) {
    throw new Error(`Invalid SEO price for ${key}: ${seoMinPrice}`);
  }

  return { ...item, seoBrand, seoName, seoMinPrice };
});

manifest.seoSnapshotGeneratedAt = audit.generatedAt || new Date().toISOString();
manifest.seoSnapshotSource = `wave${manifest.wave}-selection-audit`;

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(
  `Enriched ${manifest.products.length} wave-${manifest.wave} products`
);
