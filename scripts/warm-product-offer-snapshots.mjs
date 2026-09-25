#!/usr/bin/env node
/**
 * Контролируемо прогревает постоянные снимки предложений SEO-карточек.
 * По умолчанию берёт 50 отсутствующих/самых старых карточек, по одной за раз.
 * API сам опрашивает поставщиков и записывает только успешную непустую группу.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";
import { brandKey, canonicalBrand } from "../lib/brands/canonical.mjs";

function arg(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((part) => part.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

const baseUrl = String(
  arg("base-url", process.env.SITE_URL || "https://brocarparts.ru")
).replace(/\/$/, "");
const limit = Math.max(1, Number(arg("limit", "50")) || 50);
const concurrency = Math.max(1, Number(arg("concurrency", "1")) || 1);
const delayMs = Math.max(0, Number(arg("delay-ms", "1000")) || 0);
const maxAgeHours = Math.max(1, Number(arg("max-age-hours", "168")) || 168);
const waveArg = String(arg("wave", "all"));
const waves =
  waveArg === "all"
    ? [5, 4, 3, 2, 1]
    : waveArg
        .split(",")
        .map(Number)
        .filter((value) => Number.isInteger(value) && value >= 1 && value <= 5);

const dbUrl = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
if (!dbUrl) throw new Error("Нет DATABASE_POOLER_URL / DATABASE_URL");
if (!waves.length) throw new Error("Некорректный --wave: укажи all или 1..5");

const manifests = await Promise.all(
  waves.map(async (wave) => {
    const path = resolve(process.cwd(), `data/seo-product-wave-${wave}.json`);
    const parsed = JSON.parse(await readFile(path, "utf8"));
    return Array.isArray(parsed.products) ? parsed.products : [];
  })
);
const products = manifests.flat();

const isPooler = dbUrl.includes("pooler.supabase.com");
const sql = postgres(dbUrl, {
  ssl:
    dbUrl.includes("supabase.com") || dbUrl.includes("sslmode=require")
      ? "require"
      : undefined,
  prepare: !isPooler,
  max: 1,
  connect_timeout: 15,
});

const rows = await sql`
  SELECT article_norm, brand_key, updated_at
  FROM product_offer_snapshots
`;
await sql.end();

const known = new Map(
  rows.map((row) => [
    `${row.article_norm}|${row.brand_key}`,
    new Date(row.updated_at).getTime(),
  ])
);
const staleBefore = Date.now() - maxAgeHours * 60 * 60 * 1000;
const candidates = products
  .map((product) => {
    const articleNorm = String(product.article || "")
      .replace(/[^0-9A-Za-zА-Яа-я]/gu, "")
      .toUpperCase();
    const key = `${articleNorm}|${brandKey(canonicalBrand(product.brand))}`;
    return { ...product, snapshotAt: known.get(key) ?? 0 };
  })
  .filter((product) => product.snapshotAt < staleBefore);

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [items[index], items[target]] = [items[target], items[index]];
  }
  return items;
}

// Отсутствующие снимки важнее устаревших. Перемешивание внутри группы не даёт
// нескольким карточкам без живых офферов навсегда блокировать очередь прогрева.
const missing = shuffle(
  candidates.filter((product) => product.snapshotAt === 0)
);
const stale = shuffle(candidates.filter((product) => product.snapshotAt !== 0));
const queue = [...missing, ...stale].slice(0, limit);

console.log(
  `Прогрев снимков: волн ${waves.join(",")}, кандидатов ${queue.length}/${products.length}, параллельность ${concurrency}`
);

let succeeded = 0;
const failures = [];
const sleep = (ms) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

async function warm(product) {
  const url =
    `${baseUrl}/api/product/${encodeURIComponent(product.article)}` +
    `?brand=${encodeURIComponent(product.brand)}&snapshotWarm=${Date.now()}`;
  const response = await fetch(url, {
    headers: { "user-agent": "BroCar-offer-snapshot-warmer/1.0" },
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json();
  const offers = body?.group?.offers;
  if (!response.ok || !Array.isArray(offers) || offers.length === 0) {
    throw new Error(`HTTP ${response.status}, offers=${offers?.length ?? 0}`);
  }
  if (offers.length > 20) {
    throw new Error(`API вернул больше 20 предложений: ${offers.length}`);
  }
}

await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      const product = queue.shift();
      if (!product) return;
      try {
        await warm(product);
        succeeded += 1;
      } catch (error) {
        failures.push({
          article: product.article,
          brand: product.brand,
          error: String(error?.message || error),
        });
      }
      if (delayMs) await sleep(delayMs);
    }
  })
);

console.log(
  JSON.stringify(
    {
      selected: succeeded + failures.length,
      succeeded,
      failed: failures.length,
      failureExamples: failures.slice(0, 20),
    },
    null,
    2
  )
);
if (failures.length) process.exitCode = 1;
