#!/usr/bin/env node
/**
 * Автоприём прайс-листов Форум-Авто из почты и импорт в каталог.
 *
 * Запуск (Node 22+):
 *   node --env-file=.env.local scripts/import-forum-from-email.mjs        # боевой
 *   node --env-file=.env.local scripts/import-forum-from-email.mjs --dry  # без записи в БД
 *
 * Форум-Авто шлёт по письму на склад (CENTER, EKB, KZN). Вложение — ZIP,
 * внутри CSV (Windows-1251, разделитель ';', поля в кавычках):
 *   "марка";"каталожный номер";"наименование детали";"цена в рублях";
 *   "количество на складе";"кратность";"код";"возможность возврата"
 * Цена с десятичной запятой ("1525,6"). Склад — в имени файла
 * (FORUM_AUTO_PRICE_<CENTER|EKB|KZN>).
 *
 * Полное обновление остатков forum-auto. Товар (article+brand) — общий с
 * другими поставщиками; предложения в product_stocks (supplier_code='forum-auto').
 */

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import AdmZip from "adm-zip";
import postgres from "postgres";
import { makeImportSql } from "./import-db.mjs";
import { loadMarkupMultiplier } from "./markup.mjs";
import { detectCategory, detectCarBrands } from "../lib/catalog/classifier-data.mjs";
import { canonicalBrand } from "../lib/brands/canonical.mjs";

const DRY = process.argv.includes("--dry") || process.env.DRY_RUN === "1";

const HOST = process.env.IMAP_HOST || "imap.beget.com";
const PORT = parseInt(process.env.IMAP_PORT || "993", 10);
const USER = process.env.IMAP_USER || process.env.SMTP_USER;
const PASS = process.env.IMAP_PASSWORD || process.env.SMTP_PASSWORD;
const SENDER = process.env.FORUM_SENDER || "forum-auto";
const SINCE_DAYS = parseInt(process.env.FORUM_SINCE_DAYS || "2", 10);
const DB_URL = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;

if (!USER || !PASS) {
  console.error("❌ Нет IMAP-доступа (IMAP_USER/PASSWORD или SMTP_USER/PASSWORD).");
  process.exit(1);
}
if (!DRY && !DB_URL) {
  console.error("❌ DATABASE_URL не задан.");
  process.exit(1);
}

// Наценка магазина; в main() переопределяется значением из app_settings
// (задаётся в админке /admin/pricing). Дефолт 1.38 = 38%.
let MARKUP_MULT = 1.38;
function applyMarkup(price) {
  return Math.round(price * MARKUP_MULT);
}

const WAREHOUSE_NAMES = { CENTER: "Центр", EKB: "Екатеринбург", KZN: "Казань" };

/** FORUM_AUTO_PRICE_EKB.zip → «Екатеринбург». */
function warehouseFromFilename(filename) {
  const m = /FORUM_AUTO_PRICE_(.+?)\.(zip|csv)/i.exec(filename || "");
  const code = m ? m[1].toUpperCase() : "";
  return WAREHOUSE_NAMES[code] || code || "Форум-Авто";
}

/** Квоте-устойчивый разбор строки CSV (разделитель ';', кавычки "..."). */
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ";") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

function parseRow(line) {
  const f = parseCsvLine(line);
  if (f.length < 5) return null;
  const brand = (f[0] || "").trim();
  const article = (f[1] || "").trim();
  const name = (f[2] || "").trim();
  const price = parseFloat((f[3] || "").replace(",", ".").trim());
  const stock = parseInt((f[4] || "0").trim(), 10);
  if (!brand || !article || !name) return null;
  if (!(price > 0) || !(stock > 0)) return null;
  return { brand, article, name, price, stock };
}

const decoder = new TextDecoder("windows-1251");

async function main() {
  console.log(`📧 Приём прайс-листов Форум-Авто${DRY ? " (DRY-RUN)" : ""}`);
  console.log(`   IMAP: ${USER}@${HOST}:${PORT}`);

  const client = new ImapFlow({
    host: HOST, port: PORT, secure: true,
    auth: { user: USER, pass: PASS }, logger: false,
  });
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");

  const byWarehouse = new Map(); // warehouse → { date, uid, rows }
  try {
    const since = new Date(Date.now() - SINCE_DAYS * 864e5);
    const uids = await client.search({ since, from: SENDER }, { uid: true });
    console.log(`   Писем от «${SENDER}»: ${uids?.length || 0}`);
    if (!uids || uids.length === 0) return;

    for (const uid of uids) {
      const msg = await client.fetchOne(uid, { source: true }, { uid: true });
      if (!msg?.source) continue;
      const parsed = await simpleParser(msg.source);
      const zipAtt = (parsed.attachments || []).find(
        (a) => a.filename && /\.zip$/i.test(a.filename)
      );
      if (!zipAtt) continue;

      const warehouse = warehouseFromFilename(zipAtt.filename);
      const date = parsed.date ? parsed.date.getTime() : 0;
      const prev = byWarehouse.get(warehouse);
      if (prev && prev.date >= date) continue;

      const zip = new AdmZip(zipAtt.content);
      const entry = zip.getEntries().find((e) => /\.csv$/i.test(e.entryName));
      if (!entry) continue;
      const lines = decoder.decode(entry.getData()).split(/\r?\n/);
      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const r = parseRow(lines[i]);
        if (r) rows.push(r);
      }
      byWarehouse.set(warehouse, { date, uid, rows });
      console.log(`   • ${warehouse}: ${rows.length} позиций (${zipAtt.filename})`);
    }
  } finally {
    lock.release();
  }

  if (byWarehouse.size === 0) {
    console.log("   Прайсов Форум-Авто не найдено — выходим.");
    await client.logout();
    return;
  }

  const products = new Map();
  const seenUids = [];
  for (const [warehouse, info] of byWarehouse) {
    seenUids.push(info.uid);
    for (const r of info.rows) {
      const brand = canonicalBrand(r.brand);
      const key = `${r.article}|${brand}`;
      let p = products.get(key);
      if (!p) {
        p = {
          article: r.article, brand, name: r.name,
          category: detectCategory(r.name), carBrands: detectCarBrands(r.name),
          stocks: [],
        };
        products.set(key, p);
      }
      p.stocks.push({ warehouse, qty: r.stock, price: r.price });
    }
  }

  const productsArr = Array.from(products.values());
  const totalStockRows = productsArr.reduce((a, p) => a + p.stocks.length, 0);
  console.log(
    `\n   Складов: ${byWarehouse.size}, уникальных товаров: ${productsArr.length}, строк остатков: ${totalStockRows}`
  );

  if (DRY) {
    console.log("\n— DRY-RUN, примеры: —");
    for (const p of productsArr.slice(0, 3)) {
      console.log(
        `   ${p.brand} ${p.article} | ${p.name.slice(0, 50)} | ${p.stocks
          .map((s) => `${s.warehouse}:${s.qty}@${s.price}`)
          .join(", ")}`
      );
    }
    console.log("\n✅ DRY-RUN завершён (БД не тронута).");
    await client.logout();
    return;
  }

  const sql = await makeImportSql();
  MARKUP_MULT = await loadMarkupMultiplier(sql);
  console.log(`   наценка: ${Math.round((MARKUP_MULT - 1) * 100)}%`);
  const BATCH = 500;

  console.log("\n⬆️  Upsert products…");
  for (let i = 0; i < productsArr.length; i += BATCH) {
    const rows = productsArr.slice(i, i + BATCH).map((p) => {
      const minPrice = Math.min(...p.stocks.map((s) => s.price));
      const totalStock = p.stocks.reduce((a, s) => a + s.qty, 0);
      return {
        article: p.article, brand: p.brand, name: p.name,
        supplier_price: String(minPrice), our_price: String(applyMarkup(minPrice)),
        stock: totalStock, category_slug: p.category, car_brands: p.carBrands,
        source: "forum-auto",
      };
    });
    await sql`
      INSERT INTO products ${sql(rows, "article", "brand", "name", "supplier_price", "our_price", "stock", "category_slug", "car_brands", "source")}
      ON CONFLICT (article, brand) DO UPDATE SET
        name = EXCLUDED.name, supplier_price = EXCLUDED.supplier_price,
        our_price = EXCLUDED.our_price, stock = EXCLUDED.stock,
        category_slug = EXCLUDED.category_slug, car_brands = EXCLUDED.car_brands,
        source = EXCLUDED.source, updated_at = NOW()
    `;
  }
  console.log(`   ✓ ${productsArr.length} товаров`);

  console.log("🔎 id товаров…");
  const idRows = await sql`SELECT id, article, brand FROM products WHERE source = 'forum-auto'`;
  const idMap = new Map();
  for (const r of idRows) idMap.set(`${r.article}|${r.brand}`, Number(r.id));

  console.log("🧹 Очистка старых остатков forum-auto…");
  await sql`DELETE FROM product_stocks WHERE supplier_code = 'forum-auto'`;

  console.log("⬆️  Импорт остатков…");
  // Дедупликация по (товар + склад): один артикул может встречаться в файле
  // несколько раз (разные внутр. коды/партии). Иначе нарушится уникальный
  // индекс product_stocks(product_id, supplier_code, warehouse_name).
  const stocksMap = new Map();
  for (const p of productsArr) {
    const id = idMap.get(`${p.article}|${p.brand}`);
    if (!id) continue;
    for (const s of p.stocks) {
      const k = `${id}|${s.warehouse}`;
      const ex = stocksMap.get(k);
      if (ex) {
        ex.quantity += s.qty;
        if (s.price < ex.supplier_price) ex.supplier_price = s.price;
      } else {
        stocksMap.set(k, {
          product_id: id, warehouse_name: s.warehouse, quantity: s.qty, supplier_price: s.price,
        });
      }
    }
  }
  const stockRows = Array.from(stocksMap.values()).map((x) => ({
    product_id: x.product_id, supplier_code: "forum-auto", warehouse_name: x.warehouse_name,
    quantity: x.quantity, supplier_price: String(x.supplier_price),
    our_price: String(applyMarkup(x.supplier_price)), delivery_days: null,
  }));
  for (let i = 0; i < stockRows.length; i += BATCH) {
    await sql`
      INSERT INTO product_stocks ${sql(stockRows.slice(i, i + BATCH), "product_id", "supplier_code", "warehouse_name", "quantity", "supplier_price", "our_price", "delivery_days")}
    `;
  }
  console.log(`   ✓ ${stockRows.length} остатков`);

  await sql.end();

  const lock2 = await client.getMailboxLock("INBOX");
  try {
    for (const uid of seenUids) await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
  } finally {
    lock2.release();
  }
  await client.logout();
  console.log("\n✅ Форум-Авто импортирован, письма помечены прочитанными.");
}

main().catch((e) => {
  console.error("\n❌ Ошибка:", e.message || e);
  process.exit(1);
});
