import { readFile, writeFile } from "node:fs/promises";

import { brandKey, canonicalBrand } from "../lib/brands/canonical.mjs";
import { familyDisplayName } from "../lib/brands/families.mjs";

const manifestPath = process.argv[2];
const auditPath = process.argv[3];

if (!manifestPath || !auditPath) {
  throw new Error(
    "Usage: node scripts/enrich-seo-product-wave-2.mjs <manifest.json> <selection-audit.json>"
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

if (!Array.isArray(manifest.products) || manifest.products.length !== 1883) {
  throw new Error("Wave 2 manifest must contain exactly 1883 products");
}
if (evidence.length !== manifest.products.length) {
  throw new Error(
    `Selection audit mismatch: ${evidence.length} evidence rows for ${manifest.products.length} products`
  );
}

const evidenceByKey = new Map(
  evidence.map((item) => [identity(item.article, item.brand), item])
);

// Эти две карточки проверены на живом сайте 16.09.2026. Для них сохраняем
// лучшее фактическое название из объединённой группы поставщиков, а не
// сокращённую строку одного YML-оффера.
const verifiedOverrides = new Map([
  [
    identity("018321377B", "VAG"),
    {
      seoName:
        "Пробка резьбовая с уплотнительным кольцом (ДЛЯ ЕВРОПЕЙСКОГО РЫНКА)",
      seoMinPrice: 801,
    },
  ],
  [
    identity("020311331B", "VAG"),
    {
      seoName: "СТОПОРНОЕ КОЛЬЦО RING 020311331B",
      seoMinPrice: 1765,
    },
  ],
]);

function cleanName(rawName, article, brand) {
  let value = String(rawName || "").trim();
  const prefix = `${brand} ${article}`;
  if (value.toLocaleLowerCase("ru-RU").startsWith(prefix.toLocaleLowerCase("ru-RU"))) {
    value = value.slice(prefix.length).trim();
  }
  return value
    .replace(/КОЛЬЦОRING/gi, "КОЛЬЦО RING")
    .replace(/\s{2,}/g, " ")
    .trim();
}

manifest.products = manifest.products.map((item) => {
  const key = identity(item.article, item.brand);
  const source = evidenceByKey.get(key);
  if (!source) throw new Error(`Missing SEO evidence for ${key}`);

  const override = verifiedOverrides.get(key);
  const seoName =
    override?.seoName || cleanName(source.name, item.article, item.brand);
  const seoMinPrice = override?.seoMinPrice ?? Number(source.price);
  const seoBrand =
    familyDisplayName(item.brand) || canonicalBrand(item.brand) || item.brand;

  if (!seoName || seoName.length < 3 || seoName.length > 220) {
    throw new Error(`Invalid SEO name for ${key}: ${seoName}`);
  }
  if (!Number.isFinite(seoMinPrice) || seoMinPrice <= 0) {
    throw new Error(`Invalid SEO price for ${key}: ${seoMinPrice}`);
  }

  return {
    ...item,
    seoBrand,
    seoName,
    seoMinPrice,
  };
});

manifest.seoSnapshotGeneratedAt = audit.generatedAt || new Date().toISOString();
manifest.seoSnapshotSource = "wave2-selection-audit";

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Enriched ${manifest.products.length} wave-2 products`);
