#!/usr/bin/env node
/**
 * Автоприём прайс-листов ШАТЕ-М из почты и импорт в каталог.
 *
 * Запуск (Node 22+):
 *   node --env-file=.env.local scripts/import-shatem-from-email.mjs        # боевой
 *   node --env-file=.env.local scripts/import-shatem-from-email.mjs --dry  # без записи в БД
 *
 * ШАТЕ-М шлёт по письму на каждый склад (Пермь, Москва, Екб, Казань, Уфа,
 * Челябинск, …). Во вложении ZIP, внутри CSV (Windows-1251, разделитель ';'):
 *   Бренд; Каталожный номер; Описание; Остаток; Кратность отгрузки; Валюта; Цена; Штрихкод
 *
 * Склад берём из темы письма («Склад Пермь. …»). Каждый склад → отдельные
 * строки в product_stocks (supplier_code='shate-m'), товар (article+brand) —
 * общий с другими поставщиками. Полное обновление: старые остатки shate-m
 * удаляются и заливаются заново.
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
const SENDER = process.env.SHATEM_SENDER || "shate-m";
const SINCE_DAYS = parseInt(process.env.SHATEM_SINCE_DAYS || "2", 10);
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

/** «Склад Пермь. Актуальное …» → «Пермь». */
function warehouseFromSubject(subject) {
  const m = /Склад\s+(.+?)\./i.exec(subject || "");
  return m ? m[1].trim() : "ШАТЕ-М";
}

/** Разбор строки CSV ШАТЕ-М. Поля по краям фиксированы, описание — в середине
 *  (может само содержать ';', поэтому собираем середину). */
function parseRow(line) {
  const f = line.split(";");
  if (f.length < 8) return null;
  const brand = f[0].trim();
  const article = f[1].trim();
  const barcode = f[f.length - 1].trim();
  const price = parseFloat((f[f.length - 2] || "").replace(",", "."));
  const currency = f[f.length - 3].trim();
  const stock = parseInt(f[f.length - 5] || "0", 10);
  const name = f.slice(2, f.length - 5).join(";").trim();
  if (!brand || !article || !name) return null;
  if (!(price > 0) || !(stock > 0)) return null;
  if (currency && currency !== "RUB") return null;
  return { brand, article, name, price, stock, barcode };
}

const decoder = new TextDecoder("windows-1251");

async function main() {
  console.log(`📧 Приём прайс-листов ШАТЕ-М${DRY ? " (DRY-RUN)" : ""}`);
  console.log(`   IMAP: ${USER}@${HOST}:${PORT}`);

  const client = new ImapFlow({
    host: HOST,
    port: PORT,
    secure: true,
    auth: { user: USER, pass: PASS },
    logger: false,
  });
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");

  // warehouse → { date, uid, rows: parsedRow[] }, оставляем самое свежее на склад.
  const byWarehouse = new Map();
  const seenUids = [];
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

      const warehouse = warehouseFromSubject(parsed.subject);
      const prev = byWarehouse.get(warehouse);
      const date = parsed.date ? parsed.date.getTime() : 0;
      if (prev && prev.date >= date) continue; // уже есть более свежий

      // Распаковываем ZIP → первый CSV → win1251 → строки.
      const zip = new AdmZip(zipAtt.content);
      const entry = zip.getEntries().find((e) => /\.csv$/i.test(e.entryName));
      if (!entry) continue;
      const text = decoder.decode(entry.getData());
      const lines = text.split(/\r?\n/);
      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const r = parseRow(lines[i]);
        if (r) rows.push(r);
      }
      byWarehouse.set(warehouse, { date, uid, rows });
      console.log(`   • ${warehouse}: ${rows.length} позиций (${entry.entryName})`);
    }
  } finally {
    lock.release();
  }

  if (byWarehouse.size === 0) {
    console.log("   Прайсов ШАТЕ-М не найдено — выходим.");
    await client.logout();
    return;
  }

  // Сводим в товары (article+brand) с остатками по складам.
  const products = new Map();
  for (const [warehouse, info] of byWarehouse) {
    seenUids.push(info.uid);
    for (const r of info.rows) {
      const brand = canonicalBrand(r.brand);
      const key = `${r.article}|${brand}`;
      let p = products.get(key);
      if (!p) {
        p = {
          article: r.article,
          brand,
          name: r.name,
          category: detectCategory(r.name),
          carBrands: detectCarBrands(r.name),
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
    console.log("\n— DRY-RUN, примеры товаров: —");
    for (const p of productsArr.slice(0, 3)) {
      console.log(
        `   ${p.brand} ${p.article} | ${p.name.slice(0, 60)} | склады: ${p.stocks
          .map((s) => `${s.warehouse}:${s.qty}@${s.price}`)
          .join(", ")}`
      );
    }
    console.log("\n✅ DRY-RUN завершён (БД не тронута, письма не помечены).");
    await client.logout();
    return;
  }

  // ── Запись в БД ──────────────────────────────────────────────────────────
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
        article: p.article,
        brand: p.brand,
        name: p.name,
        supplier_price: String(minPrice),
        our_price: String(applyMarkup(minPrice)),
        stock: totalStock,
        category_slug: p.category,
        car_brands: p.carBrands,
        source: "shate-m",
      };
    });
    await sql`
      INSERT INTO products ${sql(rows, "article", "brand", "name", "supplier_price", "our_price", "stock", "category_slug", "car_brands", "source")}
      ON CONFLICT (article, brand) DO UPDATE SET
        name = EXCLUDED.name,
        supplier_price = EXCLUDED.supplier_price,
        our_price = EXCLUDED.our_price,
        stock = EXCLUDED.stock,
        category_slug = EXCLUDED.category_slug,
        car_brands = EXCLUDED.car_brands,
        source = EXCLUDED.source,
        updated_at = NOW()
    `;
  }
  console.log(`   ✓ ${productsArr.length} товаров`);

  console.log("\n🔎 id товаров…");
  const idRows = await sql`SELECT id, article, brand FROM products WHERE source = 'shate-m'`;
  const idMap = new Map();
  for (const r of idRows) idMap.set(`${r.article}|${r.brand}`, Number(r.id));

  console.log("🧹 Очистка старых остатков shate-m…");
  await sql`DELETE FROM product_stocks WHERE supplier_code = 'shate-m'`;

  console.log("⬆️  Импорт остатков…");
  // Дедупликация по (товар + склад): иначе дубли нарушают уникальный индекс
  // product_stocks(product_id, supplier_code, warehouse_name).
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
          product_id: id,
          warehouse_name: s.warehouse,
          quantity: s.qty,
          supplier_price: s.price,
        });
      }
    }
  }
  const stockRows = Array.from(stocksMap.values()).map((x) => ({
    product_id: x.product_id,
    supplier_code: "shate-m",
    warehouse_name: x.warehouse_name,
    quantity: x.quantity,
    supplier_price: String(x.supplier_price),
    our_price: String(applyMarkup(x.supplier_price)),
    delivery_days: null,
  }));
  for (let i = 0; i < stockRows.length; i += BATCH) {
    await sql`
      INSERT INTO product_stocks ${sql(stockRows.slice(i, i + BATCH), "product_id", "supplier_code", "warehouse_name", "quantity", "supplier_price", "our_price", "delivery_days")}
    `;
  }
  console.log(`   ✓ ${stockRows.length} остатков`);

  await sql.end();

  // Помечаем обработанные письма прочитанными.
  const lock2 = await client.getMailboxLock("INBOX");
  try {
    for (const uid of seenUids) {
      await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
    }
  } finally {
    lock2.release();
  }
  await client.logout();
  console.log("\n✅ ШАТЕ-М импортирован, письма помечены прочитанными.");
}

main().catch((e) => {
  console.error("\n❌ Ошибка:", e.message || e);
  process.exit(1);
});
