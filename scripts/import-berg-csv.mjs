#!/usr/bin/env node
/**
 * Импорт прайс-листа Berg (CSV, UTF-8, разделитель ';') в Supabase.
 *
 * Запуск (Node 22+):
 *   node --env-file=.env.local scripts/import-berg-csv.mjs <csv-path>
 *
 * Аргумент опционален, по умолчанию public/BERG_brocar_*.csv.
 *
 * Что делает:
 *   1. Применяет миграцию (добавляет колонки products.category_slug/source,
 *      создаёт таблицу product_stocks и уникальный индекс products.article+brand).
 *   2. Парсит CSV, группирует предложения по article+brand.
 *   3. Upsert в products (с классификацией по наименованию) + product_stocks.
 *   4. Печатает разбивку по категориям.
 */

import postgres from "postgres";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
// Единый источник правил классификации (тот же, что использует рантайм
// через lib/catalog/classifier.ts). Локальных копий больше нет.
import { detectCategory, detectCarBrands } from "../lib/catalog/classifier-data.mjs";
// Извлечение характеристик для фасетных фильтров (см. backfill-attributes.mjs).
import { extractAttributes } from "../lib/catalog/attributes.mjs";
// Каноничный бренд: схлопывает разные написания одного бренда (STELLOX/Stellox).
import { canonicalBrand } from "../lib/brands/canonical.mjs";

const CSV_PATH = process.argv[2] || "public/BERG_brocar_20260422_114614.csv";
// Приоритет: pooler (работает везде) > direct (может блокироваться провайдером)
const DB_URL = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;

if (!DB_URL) {
  console.error(
    "❌ DATABASE_URL / DATABASE_POOLER_URL отсутствует. Запуск: node --env-file=.env.local scripts/import-berg-csv.mjs"
  );
  process.exit(1);
}

function applyMarkup(price) {
  // Единая наценка 38% (запрос владельца, июль 2026; была ступенчатая
  // 52/45/42/40/38/35). Синхронно с lib/pricing.ts и остальными импортёрами.
  return Math.round(price * 1.38);
}

// ── CSV parser (; разделитель, "..." кавычки) ──────────────────────────────
function parseCsvLine(line) {
  const fields = [];
  let curr = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"') {
        if (line[i + 1] === '"') { curr += '"'; i++; }
        else inQuote = false;
      } else curr += c;
    } else {
      if (c === '"') inQuote = true;
      else if (c === ";") { fields.push(curr); curr = ""; }
      else curr += c;
    }
  }
  fields.push(curr);
  return fields;
}

// ── Main ────────────────────────────────────────────────────────────────────
// Transaction Pooler не поддерживает prepared statements — отключаем.
const isPooler = DB_URL.includes("pooler.supabase.com");
const sql = postgres(DB_URL, {
  max: 3,
  idle_timeout: 30,
  connect_timeout: 30,
  ssl: "require",
  prepare: !isPooler,
});

async function main() {
  const csvPath = resolve(CSV_PATH);
  console.log("📦 BERG CSV import starting");
  console.log("   DB:", DB_URL.replace(/:[^:@]+@/, ":***@"));
  console.log("   CSV:", csvPath);

  // 1. Миграция
  console.log("\n⚙️  Миграция схемы…");
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS category_slug TEXT`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS car_brands TEXT[]`;
  await sql`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_slug)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_products_source ON products(source)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_products_car_brands ON products USING gin(car_brands)`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS attributes JSONB`;
  await sql`CREATE INDEX IF NOT EXISTS idx_products_attributes ON products USING gin(attributes)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS uniq_products_article_brand ON products(article, brand)`;
  await sql`
    CREATE TABLE IF NOT EXISTS product_stocks (
      id BIGSERIAL PRIMARY KEY,
      product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      supplier_code TEXT NOT NULL,
      warehouse_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      supplier_price NUMERIC NOT NULL,
      our_price NUMERIC NOT NULL,
      delivery_days INTEGER,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_product_stocks_product ON product_stocks(product_id)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS uniq_product_stocks_key ON product_stocks(product_id, supplier_code, warehouse_name)`;
  console.log("   ✓ schema ok");

  // 2. Парсинг CSV
  console.log("\n📄 Парсинг CSV…");
  const t0 = Date.now();
  const rl = createInterface({
    input: createReadStream(csvPath, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  const products = new Map();
  let header = null;
  let rowNum = 0;
  let skipped = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    const fields = parseCsvLine(line);
    if (!header) { header = fields; continue; }

    rowNum++;
    if (rowNum % 50000 === 0) console.log(`   ..${rowNum} rows, ${products.size} products so far`);

    const article = (fields[0] || "").trim();
    const name = (fields[1] || "").trim();
    const brand = canonicalBrand((fields[2] || "").trim());
    const warehouse = (fields[3] || "").trim();
    const qty = parseInt(fields[4] || "0", 10);
    const price = parseFloat(fields[5] || "0");
    const delivery = parseInt(fields[8] || "0", 10);

    if (!article || !brand || !name || !(price > 0) || !(qty > 0)) { skipped++; continue; }

    const key = `${article}|${brand}`;
    let p = products.get(key);
    if (!p) {
      const category = detectCategory(name);
      p = {
        article,
        brand,
        name,
        category,
        carBrands: detectCarBrands(name),
        attributes: extractAttributes(category, name),
        stocks: [],
      };
      products.set(key, p);
    }
    p.stocks.push({ warehouse, qty, price, delivery });
  }

  console.log(`   ✓ ${rowNum} строк за ${((Date.now() - t0) / 1000).toFixed(1)}с`);
  console.log(`   ✓ уникальных товаров: ${products.size}, пропущено строк: ${skipped}`);

  // 3. Upsert products батчами
  console.log("\n⬆️  Upsert products…");
  const BATCH = 500;
  const productsArr = Array.from(products.values());
  const t1 = Date.now();

  for (let i = 0; i < productsArr.length; i += BATCH) {
    const batch = productsArr.slice(i, i + BATCH);
    const rows = batch.map((p) => {
      const minPrice = Math.min(...p.stocks.map((s) => s.price));
      const totalStock = p.stocks.reduce((a, s) => a + s.qty, 0);
      return {
        article: p.article,
        brand: p.brand,
        name: p.name,
        supplier_price: String(minPrice),
        our_price: String(applyMarkup(minPrice)),
        stock: totalStock,
        category_slug: p.category,
        car_brands: p.carBrands,
        attributes: sql.json(p.attributes ?? {}),
        source: "berg",
      };
    });

    await sql`
      INSERT INTO products ${sql(rows, "article","brand","name","supplier_price","our_price","stock","category_slug","car_brands","attributes","source")}
      ON CONFLICT (article, brand) DO UPDATE SET
        name = EXCLUDED.name,
        supplier_price = EXCLUDED.supplier_price,
        our_price = EXCLUDED.our_price,
        stock = EXCLUDED.stock,
        category_slug = EXCLUDED.category_slug,
        car_brands = EXCLUDED.car_brands,
        attributes = EXCLUDED.attributes,
        source = EXCLUDED.source,
        updated_at = NOW()
    `;

    if ((i / BATCH) % 10 === 0) {
      const pct = ((i / productsArr.length) * 100).toFixed(0);
      console.log(`   products: ${i}/${productsArr.length} (${pct}%)`);
    }
  }
  console.log(`   ✓ products done за ${((Date.now() - t1) / 1000).toFixed(1)}с`);

  // 4. Получить id-ники
  console.log("\n🔎 Получение id товаров…");
  const rows = await sql`SELECT id, article, brand FROM products WHERE source = 'berg'`;
  const idMap = new Map();
  for (const r of rows) idMap.set(`${r.article}|${r.brand}`, Number(r.id));
  console.log(`   ✓ id для ${idMap.size} товаров`);

  // 5. Очистка и импорт stocks
  console.log("\n🧹 Очистка старых остатков berg…");
  await sql`DELETE FROM product_stocks WHERE supplier_code = 'berg'`;

  console.log("\n⬆️  Импорт остатков…");
  const t2 = Date.now();
  // Дедупликация: у одного товара на одном складе может быть несколько
  // строк (разные партии с разной ценой/сроком). Склеиваем их в одну:
  // суммируем qty, берём минимальную цену и минимальный срок.
  const stocksMap = new Map();
  for (const p of productsArr) {
    const id = idMap.get(`${p.article}|${p.brand}`);
    if (!id) continue;
    for (const s of p.stocks) {
      const key = `${id}|${s.warehouse}`;
      const existing = stocksMap.get(key);
      if (existing) {
        existing.quantity += s.qty;
        if (s.price < existing.supplier_price) existing.supplier_price = s.price;
        if (existing.delivery_days == null || s.delivery < existing.delivery_days) {
          existing.delivery_days = s.delivery;
        }
      } else {
        stocksMap.set(key, {
          product_id: id,
          supplier_code: "berg",
          warehouse_name: s.warehouse,
          quantity: s.qty,
          supplier_price: s.price,
          delivery_days: s.delivery,
        });
      }
    }
  }

  const stockRows = Array.from(stocksMap.values()).map((x) => ({
    product_id: x.product_id,
    supplier_code: x.supplier_code,
    warehouse_name: x.warehouse_name,
    quantity: x.quantity,
    supplier_price: String(x.supplier_price),
    our_price: String(applyMarkup(x.supplier_price)),
    delivery_days: x.delivery_days,
  }));
  console.log(`   после дедупликации: ${stockRows.length} остатков (было до ~${productsArr.reduce((a, p) => a + p.stocks.length, 0)})`);

  for (let i = 0; i < stockRows.length; i += BATCH) {
    const batch = stockRows.slice(i, i + BATCH);
    await sql`
      INSERT INTO product_stocks ${sql(batch, "product_id","supplier_code","warehouse_name","quantity","supplier_price","our_price","delivery_days")}
    `;
    if ((i / BATCH) % 20 === 0) {
      const pct = ((i / stockRows.length) * 100).toFixed(0);
      console.log(`   stocks: ${i}/${stockRows.length} (${pct}%)`);
    }
  }
  console.log(`   ✓ stocks done за ${((Date.now() - t2) / 1000).toFixed(1)}с`);

  // 6. Отчёт
  console.log("\n📊 Разбивка по категориям:");
  const cats = await sql`
    SELECT category_slug, COUNT(*)::int as count
    FROM products WHERE source='berg'
    GROUP BY category_slug
    ORDER BY count DESC
  `;
  for (const c of cats) console.log(`   ${String(c.category_slug).padEnd(22)} ${c.count}`);

  console.log("\n🚗 Разбивка по маркам авто (топ-25):");
  const carBrands = await sql`
    SELECT brand, COUNT(*)::int as count FROM (
      SELECT UNNEST(car_brands) AS brand FROM products WHERE source='berg' AND car_brands IS NOT NULL
    ) t
    GROUP BY brand ORDER BY count DESC LIMIT 25
  `;
  for (const c of carBrands) console.log(`   ${String(c.brand).padEnd(22)} ${c.count}`);

  await sql.end();
  console.log("\n🎉 Импорт завершён");
}

main().catch((e) => {
  console.error("\n❌ Error:", e);
  process.exit(1);
});
