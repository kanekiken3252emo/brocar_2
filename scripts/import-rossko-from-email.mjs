#!/usr/bin/env node
/**
 * Автоприём прайс-листа Россико (Rossko) из почты и импорт в каталог.
 *
 * Запуск (Node 22+):
 *   node --env-file=.env.local scripts/import-rossko-from-email.mjs        # боевой
 *   node --env-file=.env.local scripts/import-rossko-from-email.mjs --dry  # без записи в БД
 *
 * Россико шлёт ZIP, внутри XLSX. Колонки:
 *   Номенклатура | Бренд | Артикул | Описание | Вес/Объем | Кратность отгрузки |
 *   Цена, руб. | Базовая цена, руб. | Наличие | Срок поставки, дн. | Каталожный номер | …
 * Один файл (общий склад). Есть срок поставки — кладём в delivery_days.
 * Полное обновление остатков rossko.
 */

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import AdmZip from "adm-zip";
import ExcelJS from "exceljs";
import postgres from "postgres";
import { detectCategory, detectCarBrands } from "../lib/catalog/classifier-data.mjs";
import { canonicalBrand } from "../lib/brands/canonical.mjs";

const DRY = process.argv.includes("--dry") || process.env.DRY_RUN === "1";

const HOST = process.env.IMAP_HOST || "imap.beget.com";
const PORT = parseInt(process.env.IMAP_PORT || "993", 10);
const USER = process.env.IMAP_USER || process.env.SMTP_USER;
const PASS = process.env.IMAP_PASSWORD || process.env.SMTP_PASSWORD;
const SENDER = process.env.ROSSKO_SENDER || "rossko";
const SINCE_DAYS = parseInt(process.env.ROSSKO_SINCE_DAYS || "2", 10);
const DB_URL = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
const WAREHOUSE = "Основной";

if (!USER || !PASS) {
  console.error("❌ Нет IMAP-доступа (IMAP_USER/PASSWORD или SMTP_USER/PASSWORD).");
  process.exit(1);
}
if (!DRY && !DB_URL) {
  console.error("❌ DATABASE_URL не задан.");
  process.exit(1);
}

function applyMarkup(price) {
  // Единая наценка 38% (запрос владельца, июль 2026; была ступенчатая
  // 52/45/42/40/38/35). Синхронно с lib/pricing.ts и остальными импортёрами.
  return Math.round(price * 1.38);
}

function num(s) {
  return parseFloat(String(s ?? "").replace(/\s/g, "").replace(",", ".")) || 0;
}

async function parseXlsx(buf) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  const rows = [];
  ws.eachRow((row, rn) => {
    if (rn === 1) return;
    // Наименование — в «Описание» [4]; «Номенклатура» [1] это внутр. код (NSII…).
    const name = (String(row.getCell(4).text || "").trim() || String(row.getCell(1).text || "").trim());
    const brand = String(row.getCell(2).text || "").trim();
    const article = String(row.getCell(3).text || "").trim();
    const price = num(row.getCell(7).text);
    const stockM = String(row.getCell(9).text || "").match(/\d+/);
    const stock = stockM ? parseInt(stockM[0], 10) : 0;
    const dM = String(row.getCell(10).text || "").match(/\d+/);
    const delivery = dM ? parseInt(dM[0], 10) : null;
    if (!brand || !article || !name) return;
    if (!(price > 0) || !(stock > 0)) return;
    rows.push({ brand, article, name, price, stock, delivery });
  });
  return rows;
}

async function main() {
  console.log(`📧 Приём прайс-листа Россико${DRY ? " (DRY-RUN)" : ""}`);
  console.log(`   IMAP: ${USER}@${HOST}:${PORT}`);

  const client = new ImapFlow({
    host: HOST, port: PORT, secure: true,
    auth: { user: USER, pass: PASS }, logger: false,
  });
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");

  let rows = [];
  let pickedUid = null;
  try {
    const since = new Date(Date.now() - SINCE_DAYS * 864e5);
    const uids = await client.search({ since, from: SENDER }, { uid: true });
    console.log(`   Писем от «${SENDER}»: ${uids?.length || 0}`);
    if (!uids || uids.length === 0) return;

    // Берём самое свежее письмо с ZIP-вложением.
    for (const uid of [...uids].sort((a, b) => b - a)) {
      const msg = await client.fetchOne(uid, { source: true }, { uid: true });
      if (!msg?.source) continue;
      const parsed = await simpleParser(msg.source);
      const zipAtt = (parsed.attachments || []).find((a) => a.filename && /\.zip$/i.test(a.filename));
      if (!zipAtt) continue;
      const zip = new AdmZip(zipAtt.content);
      const entry = zip.getEntries().find((e) => /\.xlsx$/i.test(e.entryName));
      if (!entry) continue;
      rows = await parseXlsx(entry.getData());
      pickedUid = uid;
      console.log(`   • ${entry.entryName}: ${rows.length} позиций`);
      break;
    }
  } finally {
    lock.release();
  }

  if (rows.length === 0) {
    console.log("   Прайс Россико не найден — выходим.");
    await client.logout();
    return;
  }

  const products = new Map();
  for (const r of rows) {
    const brand = canonicalBrand(r.brand);
    const key = `${r.article}|${brand}`;
    let p = products.get(key);
    if (!p) {
      p = {
        article: r.article, brand, name: r.name,
        category: detectCategory(r.name), carBrands: detectCarBrands(r.name),
        qty: 0, minPrice: Infinity, delivery: null,
      };
      products.set(key, p);
    }
    p.qty += r.stock;
    if (r.price < p.minPrice) p.minPrice = r.price;
    if (r.delivery != null && (p.delivery == null || r.delivery < p.delivery)) p.delivery = r.delivery;
  }

  const productsArr = Array.from(products.values());
  console.log(`\n   Уникальных товаров: ${productsArr.length}`);

  if (DRY) {
    console.log("\n— DRY-RUN, примеры: —");
    for (const p of productsArr.slice(0, 4)) {
      console.log(`   ${p.brand} ${p.article} | ${p.name.slice(0, 50)} | qty:${p.qty} цена:${p.minPrice} срок:${p.delivery}`);
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
    const batch = productsArr.slice(i, i + BATCH).map((p) => ({
      article: p.article, brand: p.brand, name: p.name,
      supplier_price: String(p.minPrice), our_price: String(applyMarkup(p.minPrice)),
      stock: p.qty, category_slug: p.category, car_brands: p.carBrands, source: "rossko",
    }));
    await sql`
      INSERT INTO products ${sql(batch, "article", "brand", "name", "supplier_price", "our_price", "stock", "category_slug", "car_brands", "source")}
      ON CONFLICT (article, brand) DO UPDATE SET
        name = EXCLUDED.name, supplier_price = EXCLUDED.supplier_price,
        our_price = EXCLUDED.our_price, stock = EXCLUDED.stock,
        category_slug = EXCLUDED.category_slug, car_brands = EXCLUDED.car_brands,
        source = EXCLUDED.source, updated_at = NOW()
    `;
  }
  console.log(`   ✓ ${productsArr.length} товаров`);

  console.log("🔎 id товаров…");
  const idRows = await sql`SELECT id, article, brand FROM products WHERE source = 'rossko'`;
  const idMap = new Map();
  for (const r of idRows) idMap.set(`${r.article}|${r.brand}`, Number(r.id));

  console.log("🧹 Очистка старых остатков rossko…");
  await sql`DELETE FROM product_stocks WHERE supplier_code = 'rossko'`;

  console.log("⬆️  Импорт остатков…");
  const stockRows = [];
  for (const p of productsArr) {
    const id = idMap.get(`${p.article}|${p.brand}`);
    if (!id) continue;
    stockRows.push({
      product_id: id, supplier_code: "rossko", warehouse_name: WAREHOUSE,
      quantity: p.qty, supplier_price: String(p.minPrice),
      our_price: String(applyMarkup(p.minPrice)), delivery_days: p.delivery,
    });
  }
  for (let i = 0; i < stockRows.length; i += BATCH) {
    await sql`
      INSERT INTO product_stocks ${sql(stockRows.slice(i, i + BATCH), "product_id", "supplier_code", "warehouse_name", "quantity", "supplier_price", "our_price", "delivery_days")}
    `;
  }
  console.log(`   ✓ ${stockRows.length} остатков`);

  await sql.end();

  if (pickedUid != null) {
    const lock2 = await client.getMailboxLock("INBOX");
    try { await client.messageFlagsAdd(pickedUid, ["\\Seen"], { uid: true }); }
    finally { lock2.release(); }
  }
  await client.logout();
  console.log("\n✅ Россико импортирован, письмо помечено прочитанным.");
}

main().catch((e) => {
  console.error("\n❌ Ошибка:", e.message || e);
  process.exit(1);
});
