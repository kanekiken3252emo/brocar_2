import { createReadStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";

import { brandKey, canonicalBrand } from "../lib/brands/canonical.mjs";

const TARGET_SIZE = 2_500;
const MAX_PER_PRIORITY_CATEGORY = 220;
const MAX_PER_OTHER_CATEGORY = 120;
const MAX_PER_BRAND = 140;
const MAX_BRANDS_PER_ARTICLE = 3;
const PRIORITY_CATEGORY_IDS = [46, 11, 10, 7, 25, 32, 30, 24, 19, 6];

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) {
      throw new Error(`Invalid argument near ${key || "end of command"}`);
    }
    result[key.slice(2)] = value;
  }
  return result;
}

function normalizeArticle(value) {
  return String(value || "")
    .replace(/[^0-9A-Za-zА-Яа-я]/g, "")
    .toUpperCase();
}

function isVin(value) {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(value);
}

function xmlDecode(value) {
  return String(value || "")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function tag(line, name) {
  const match = line.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return match ? xmlDecode(match[1]).trim() : "";
}

function identity(article, brand) {
  return `${normalizeArticle(article)}|${brandKey(canonicalBrand(brand))}`;
}

function increment(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function sortCandidates(left, right) {
  return (
    Number(right.hasPicture) - Number(left.hasPicture) ||
    Number(right.categorized) - Number(left.categorized) ||
    right.demandBrandCount - left.demandBrandCount ||
    left.price - right.price ||
    left.article.localeCompare(right.article, "ru") ||
    left.brandKey.localeCompare(right.brandKey, "ru")
  );
}

const args = parseArgs(process.argv.slice(2));
for (const required of [
  "feed",
  "demand",
  "wave1",
  "wave2",
  "wave3",
  "manifest",
  "audit",
]) {
  if (!args[required]) throw new Error(`Missing --${required}`);
}

const demandPayload = JSON.parse(await readFile(args.demand, "utf8"));
const demandRows = Array.isArray(demandPayload.candidates)
  ? demandPayload.candidates
  : [];
const demand = new Map(
  demandRows.map((row, index) => [
    normalizeArticle(row.article),
    {
      priority: Number(row.priority) || index + 1,
      visits: 0,
      goals: 0,
      revenue: 0,
    },
  ])
);

if (args.metrics) {
  const metricsPayload = JSON.parse(await readFile(args.metrics, "utf8"));
  const metricsRows = Array.isArray(metricsPayload.candidates)
    ? metricsPayload.candidates
    : [];
  for (const row of metricsRows) {
    const article = normalizeArticle(row.article);
    const current = demand.get(article);
    if (!current) continue;
    demand.set(article, {
      ...current,
      visits: Number(row.visits) || 0,
      goals: Number(row.goals) || 0,
      revenue: Number(row.revenue) || 0,
    });
  }
}

const wave1Payload = JSON.parse(await readFile(args.wave1, "utf8"));
const wave2Payload = JSON.parse(await readFile(args.wave2, "utf8"));
const wave3Payload = JSON.parse(await readFile(args.wave3, "utf8"));
const wave1Products = Array.isArray(wave1Payload.products)
  ? wave1Payload.products
  : [];
const wave2Products = Array.isArray(wave2Payload.products)
  ? wave2Payload.products
  : [];
const wave3Products = Array.isArray(wave3Payload.products)
  ? wave3Payload.products
  : [];
const priorProducts = [...wave1Products, ...wave2Products, ...wave3Products];
const priorKeys = new Set(
  priorProducts.map((row) => identity(row.article, row.brand))
);
const representedBrandCounts = new Map();
for (const row of priorProducts) {
  increment(representedBrandCounts, brandKey(canonicalBrand(row.brand)));
}

const seen = new Set();
const pool = [];
let feedGeneratedAt = null;
let totalOffers = 0;
let validOffers = 0;
let excludedPriorWaves = 0;
let excludedVin = 0;

const input = createInterface({
  input: createReadStream(args.feed, { encoding: "utf8" }),
  crlfDelay: Infinity,
});

for await (const line of input) {
  if (!feedGeneratedAt && line.startsWith("<yml_catalog ")) {
    const dateMatch = line.match(/date="([^"]+)"/);
    if (dateMatch) feedGeneratedAt = new Date(dateMatch[1]).toISOString();
    continue;
  }
  if (!line.startsWith("<offer ")) continue;
  totalOffers += 1;

  const available = /available="true"/.test(line);
  const article = normalizeArticle(tag(line, "vendorCode"));
  const brand = canonicalBrand(tag(line, "vendor"));
  const name = tag(line, "name");
  const price = Number(tag(line, "price"));
  const categoryId = Number(tag(line, "categoryId"));
  const sourceUrl = tag(line, "url");
  const picture = tag(line, "picture");

  if (
    !available ||
    article.length < 3 ||
    article.length > 32 ||
    !brand ||
    name.length < 8 ||
    name.length > 150 ||
    /снят|заменен/i.test(name) ||
    /[\\!]/.test(name) ||
    !sourceUrl ||
    !Number.isFinite(price) ||
    price <= 0 ||
    price >= 10_000_000 ||
    name.includes("�")
  ) {
    continue;
  }
  validOffers += 1;

  if (isVin(article)) {
    excludedVin += 1;
    continue;
  }

  const key = identity(article, brand);
  if (seen.has(key)) continue;
  seen.add(key);
  if (priorKeys.has(key)) {
    excludedPriorWaves += 1;
    continue;
  }

  const categorized =
    Number.isInteger(categoryId) && categoryId >= 1 && categoryId <= 49;
  const hasPicture = Boolean(picture);
  const demandBrandCount = representedBrandCounts.get(brandKey(brand)) || 0;
  pool.push({
    article,
    brand,
    brandKey: brandKey(brand),
    name,
    price,
    categoryId,
    sourceUrl,
    hasPicture,
    categorized,
    demandBrandCount,
    demand: demand.get(article) || null,
  });
}

if (!feedGeneratedAt)
  throw new Error("The YML feed date is missing or invalid");

const selected = [];
const selectedKeys = new Set();
const categoryCounts = new Map();
const brandCounts = new Map();
const articleCounts = new Map();

function canSelect(row, enforceCaps) {
  const key = identity(row.article, row.brand);
  if (selectedKeys.has(key)) return false;
  if ((articleCounts.get(row.article) || 0) >= MAX_BRANDS_PER_ARTICLE)
    return false;
  if (!enforceCaps) return true;
  const categoryLimit = PRIORITY_CATEGORY_IDS.includes(row.categoryId)
    ? MAX_PER_PRIORITY_CATEGORY
    : MAX_PER_OTHER_CATEGORY;
  if ((categoryCounts.get(row.categoryId) || 0) >= categoryLimit) return false;
  if ((brandCounts.get(row.brandKey) || 0) >= MAX_PER_BRAND) return false;
  return true;
}

function add(row, reason, enforceCaps = true) {
  if (!canSelect(row, enforceCaps)) return false;
  selected.push({ ...row, reason });
  selectedKeys.add(identity(row.article, row.brand));
  increment(categoryCounts, row.categoryId);
  increment(brandCounts, row.brandKey);
  increment(articleCounts, row.article);
  return true;
}

const directDemand = pool
  .filter((row) => row.demand)
  .sort(
    (left, right) =>
      left.demand.priority - right.demand.priority ||
      sortCandidates(left, right)
  );
for (const row of directDemand) add(row, "external_article_demand", false);

const qualityPool = pool.filter(
  (row) =>
    !row.demand && row.categorized && row.hasPicture && row.demandBrandCount > 0
);
const categoryOrder = [
  ...PRIORITY_CATEGORY_IDS,
  ...[...new Set(qualityPool.map((row) => row.categoryId))]
    .filter((id) => !PRIORITY_CATEGORY_IDS.includes(id))
    .sort((left, right) => left - right),
];

for (const categoryId of categoryOrder) {
  const rows = qualityPool
    .filter((row) => row.categoryId === categoryId)
    .sort(sortCandidates);
  for (const row of rows) {
    if (selected.length >= TARGET_SIZE) break;
    add(row, "fresh_categorized_inventory");
  }
  if (selected.length >= TARGET_SIZE) break;
}

if (selected.length !== TARGET_SIZE) {
  throw new Error(
    `Could not fill wave 4: selected ${selected.length} of ${TARGET_SIZE}`
  );
}

const selectedProducts = selected.map((row) => ({
  article: row.article,
  brand: row.brand,
  brandKey: row.brandKey,
  lastModified: feedGeneratedAt,
}));
const selectedKeyList = selectedProducts.map((row) =>
  identity(row.article, row.brand)
);
if (new Set(selectedKeyList).size !== selectedProducts.length) {
  throw new Error("Wave 4 contains duplicate product identities");
}
if (selectedKeyList.some((key) => priorKeys.has(key))) {
  throw new Error("Wave 4 overlaps a prior wave");
}
if (selectedProducts.some((row) => isVin(row.article))) {
  throw new Error("Wave 4 contains a VIN-like article");
}

const manifest = {
  wave: 4,
  generatedAt: feedGeneratedAt.slice(0, 10),
  targetSize: TARGET_SIZE,
  selectionRule:
    "current stock and positive price; first remaining direct external article demand, then products with image, defined category and a brand represented in prior waves; category and brand caps; no overlap with waves 1-3; max 3 brands per article",
  productCount: selectedProducts.length,
  products: selectedProducts,
};

const reasonCounts = new Map();
for (const row of selected) increment(reasonCounts, row.reason);
const audit = {
  generatedAt: new Date().toISOString(),
  feedGeneratedAt,
  source: {
    feed: args.feed,
    demand: args.demand,
    metrics: args.metrics || null,
    wave1: args.wave1,
    wave2: args.wave2,
    wave3: args.wave3,
  },
  rules: {
    targetSize: TARGET_SIZE,
    maxPerPriorityCategory: MAX_PER_PRIORITY_CATEGORY,
    maxPerOtherCategory: MAX_PER_OTHER_CATEGORY,
    maxPerBrand: MAX_PER_BRAND,
    maxBrandsPerArticle: MAX_BRANDS_PER_ARTICLE,
    priorityCategoryIds: PRIORITY_CATEGORY_IDS,
  },
  counts: {
    totalOffers,
    validOffers,
    uniqueAfterNormalization: seen.size,
    excludedPriorWaves,
    excludedVin,
    eligiblePool: pool.length,
    directDemandPool: directDemand.length,
    qualityPool: qualityPool.length,
    selected: selected.length,
    overlapWithPriorWaves: 0,
    duplicateIdentities: 0,
    vinLikeSelected: 0,
  },
  selectionReasons: Object.fromEntries(reasonCounts),
  demandEvidence: {
    visits: selected.reduce((sum, row) => sum + (row.demand?.visits || 0), 0),
    goals: selected.reduce((sum, row) => sum + (row.demand?.goals || 0), 0),
    revenue: selected.reduce((sum, row) => sum + (row.demand?.revenue || 0), 0),
  },
  categoryCounts: Object.fromEntries(
    [...categoryCounts.entries()].sort((left, right) => left[0] - right[0])
  ),
  brandCounts: Object.fromEntries(
    [...brandCounts.entries()].sort((left, right) => right[1] - left[1])
  ),
  selectedEvidence: selected.map((row) => ({
    article: row.article,
    brand: row.brand,
    brandKey: row.brandKey,
    name: row.name,
    price: row.price,
    categoryId: row.categoryId,
    sourceUrl: row.sourceUrl,
    selectionReason: row.reason,
    demandPriority: row.demand?.priority || null,
    visits: row.demand?.visits || 0,
    goals: row.demand?.goals || 0,
    revenue: row.demand?.revenue || 0,
  })),
};

await writeFile(
  args.manifest,
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8"
);
await writeFile(args.audit, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify(
    {
      selected: selected.length,
      selectionReasons: audit.selectionReasons,
      categoryCount: categoryCounts.size,
      brandCount: brandCounts.size,
      excludedPriorWaves,
    },
    null,
    2
  )
);
