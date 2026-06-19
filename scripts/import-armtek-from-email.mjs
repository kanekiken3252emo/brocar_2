#!/usr/bin/env node
/**
 * Автоприём прайс-листа Армтек из почты и импорт в каталог.
 *
 * Запуск (Node 22+):
 *   node --env-file=.env.local scripts/import-armtek-from-email.mjs        # боевой
 *   node --env-file=.env.local scripts/import-armtek-from-email.mjs --dry  # без записи в БД
 *
 * Армтек шлёт ZIP, внутри XLSX (Excel). Лист с колонками:
 *   Бренд | Нормированный код производителя | Наименование |
 *   Код артикула компании | Код производителя | Количество | Цена с точкой
 * Склад — в имени файла (ARMTEK_<MAIN|…>). Полное обновление остатков armtek.
 */

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import AdmZip from "adm-zip";
import ExcelJS from "exceljs";
import postgres from "postgres";
import { detectCategory, detectCarBrands } from "../lib/catalog/classifier-data.mjs";

const DRY = process.argv.includes("--dry") || process.env.DRY_RUN === "1";

const HOST = process.env.IMAP_HOST || "imap.beget.com";
const PORT = parseInt(process.env.IMAP_PORT || "993", 10);
const USER = process.env.IMAP_USER || process.env.SMTP_USER;
const PASS = process.env.IMAP_PASSWORD || process.env.SMTP_PASSWORD;
const SENDER = process.env.ARMTEK_SENDER || "armtek";
const SINCE_DAYS = parseInt(process.env.ARMTEK_SINCE_DAYS || "2", 10);
const DB_URL = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;

// Армтек иногда присылает остаток-«заглушку» (≈3 млрд = «очень много в наличии»),
// что не влезает в integer-колонку stock (потолок ~2,1 млрд) и роняет всю вставку.
// Обрезаем до разумного потолка — для автозапчасти 99999 шт. это «есть в избытке».
const MAX_STOCK = 99999;
function clampStock(n) {
  return Number.isFinite(n) && n > MAX_STOCK ? MAX_STOCK : n;
}

if (!USER || !PASS) {
  console.error("❌ Нет IMAP-доступа (IMAP_USER/PASSWORD или SMTP_USER/PASSWORD).");
  process.exit(1);
}
if (!DRY && !DB_URL) {
  console.error("❌ DATABASE_URL не задан.");
  process.exit(1);
}

function applyMarkup(price) {
  let mult;
  if (price < 100) mult = 1.52;
  else if (price < 500) mult = 1.45;
  else if (price < 1000) mult = 1.42;
  else if (price < 10000) mult = 1.4;
  else if (price < 40000) mult = 1.38;
  else mult = 1.35;
  return Math.round(price * mult);
}

const WAREHOUSE_NAMES = { MAIN: "Основной" };
function warehouseFromFilename(filename) {
  const m = /ARMTEK_([A-Z0-9]+)/i.exec(filename || "");
  const code = m ? m[1].toUpperCase() : "";
  return WAREHOUSE_NAMES[code] || code || "Армтек";
}

const decoder = new TextDecoder("windows-1251"); // на случай csv; xlsx — через exceljs

/**
 * Армтек присылает часть позиций в АЛЬТ-формате: в колонке A — код/EAN, а в
 * колонке B — «Название™Бренд» (вместо артикула). Распознаём по символу «™» и
 * раскладываем правильно: артикул = код из A, бренд и название достаём из B.
 * Обычные строки (без «™») не трогаем.
 */
function fixArmtekFields(brand, article, name) {
  const tm = article.indexOf("™");
  if (tm !== -1) {
    return {
      article: brand,
      name: article.slice(0, tm).trim(),
      brand: article.slice(tm + 1).trim(),
    };
  }
  return { brand, article, name };
}

/** Парсит xlsx (Buffer) → массив строк-товаров. */
async function parseXlsx(buf) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  const rows = [];
  ws.eachRow((row, rn) => {
    if (rn === 1) return; // заголовок
    let brand = String(row.getCell(1).text || "").trim();
    let article = String(row.getCell(2).text || "").trim();
    let name = String(row.getCell(3).text || "").trim();
    const stock = clampStock(parseInt(String(row.getCell(6).text || "0").replace(/\s/g, ""), 10));
    const price = parseFloat(
      String(row.getCell(7).text || "0").replace(",", ".").replace(/\s/g, "")
    );
    ({ brand, article, name } = fixArmtekFields(brand, article, name));
    if (!brand || !article || !name) return;
    if (!(price > 0) || !(stock > 0)) return;
    rows.push({ brand, article, name, price, stock });
  });
  return rows;
}

async function main() {
  console.log(`📧 Приём прайс-листа Армтек${DRY ? " (DRY-RUN)" : ""}`);
  console.log(`   IMAP: ${USER}@${HOST}:${PORT}`);

  const client = new ImapFlow({
    host: HOST, port: PORT, secure: true,
    auth: { user: USER, pass: PASS }, logger: false,
  });
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");

  const byWarehouse = new Map();
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
      const entry = zip.getEntries().find((e) => /\.(xlsx|csv)$/i.test(e.entryName));
      if (!entry) continue;
      let rows;
      if (/\.xlsx$/i.test(entry.entryName)) {
        rows = await parseXlsx(entry.getData());
      } else {
        // запасной путь, если когда-то пришлют csv
        const lines = decoder.decode(entry.getData()).split(/\r?\n/);
        rows = [];
        for (let i = 1; i < lines.length; i++) {
          const f = lines[i].split(";");
          if (f.length < 7) continue;
          const price = parseFloat((f[6] || "").replace(",", "."));
          const stock = clampStock(parseInt(f[5] || "0", 10));
          if (f[0] && f[1] && f[2] && price > 0 && stock > 0) {
            const fixed = fixArmtekFields(f[0].trim(), f[1].trim(), f[2].trim());
            if (fixed.brand && fixed.article && fixed.name)
              rows.push({ ...fixed, price, stock });
          }
        }
      }
      byWarehouse.set(warehouse, { date, uid, rows });
      console.log(`   • ${warehouse}: ${rows.length} позиций (${zipAtt.filename})`);
    }
  } finally {
    lock.release();
  }

  if (byWarehouse.size === 0) {
    console.log("   Прайсов Армтек не найдено — выходим.");
    await client.logout();
    return;
  }

  const products = new Map();
  const seenUids = [];
  for (const [warehouse, info] of byWarehouse) {
    seenUids.push(info.uid);
    for (const r of info.rows) {
      const key = `${r.article}|${r.brand}`;
      let p = products.get(key);
      if (!p) {
        p = {
          article: r.article, brand: r.brand, name: r.name,
          category: detectCategory(r.name), carBrands: detectCarBrands(r.name),
          stocks: [],
        };
        products.set(key, p);
      }
      p.stocks.push({ warehouse, qty: r.stock, price: r.price });
    }
  }

  const productsArr = Array.from(products.values());
  console.log(
    `\n   Складов: ${byWarehouse.size}, уникальных товаров: ${productsArr.length}`
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

  const isPooler = DB_URL.includes("pooler.supabase.com");
  const sql = postgres(DB_URL, {
    max: 3, idle_timeout: 30, connect_timeout: 30, ssl: "require", prepare: !isPooler,
  });
  const BATCH = 500;

  console.log("\n⬆️  Upsert products…");
  for (let i = 0; i < productsArr.length; i += BATCH) {
    const rows = productsArr.slice(i, i + BATCH).map((p) => {
      const minPrice = Math.min(...p.stocks.map((s) => s.price));
      const totalStock = clampStock(p.stocks.reduce((a, s) => a + s.qty, 0));
      return {
        article: p.article, brand: p.brand, name: p.name,
        supplier_price: String(minPrice), our_price: String(applyMarkup(minPrice)),
        stock: totalStock, category_slug: p.category, car_brands: p.carBrands,
        source: "armtek",
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
  const idRows = await sql`SELECT id, article, brand FROM products WHERE source = 'armtek'`;
  const idMap = new Map();
  for (const r of idRows) idMap.set(`${r.article}|${r.brand}`, Number(r.id));

  console.log("🧹 Очистка старых остатков armtek…");
  await sql`DELETE FROM product_stocks WHERE supplier_code = 'armtek'`;

  console.log("⬆️  Импорт остатков…");
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
    product_id: x.product_id, supplier_code: "armtek", warehouse_name: x.warehouse_name,
    quantity: clampStock(x.quantity), supplier_price: String(x.supplier_price),
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
  console.log("\n✅ Армтек импортирован, письма помечены прочитанными.");
}

main().catch((e) => {
  console.error("\n❌ Ошибка:", e.message || e);
  process.exit(1);
});
