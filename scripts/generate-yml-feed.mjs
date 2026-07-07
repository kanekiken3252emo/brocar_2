#!/usr/bin/env node
/**
 * Генерация YML-фида (yml_catalog) для Яндекс Вебмастера («Товары и цены») и
 * бесплатного размещения в Яндекс Товарах.
 *
 *   node --env-file=.env.local scripts/generate-yml-feed.mjs            # локально
 *   docker exec -u root brocar-app node /app/scripts/generate-yml-feed.mjs  # на проде (cron)
 *
 * Что внутри:
 *  • товары в наличии (stock > 0) с валидной ценой — ~190k позиций;
 *  • категории из CATEGORY_META (+ фолбэк «Автозапчасти» для неразмеченных);
 *  • картинки из кэша product_images (если есть);
 *  • курсорное чтение из БД (память не растёт) и атомарная запись:
 *    пишем во временный файл → rename, чтобы Яндекс не скачал полфида.
 *
 * Параметры (env):
 *   YML_OUT     — куда писать (по умолчанию /app/public/feeds/yandex-market.yml
 *                 в контейнере; локально — public/feeds/yandex-market.yml)
 *   YML_LIMIT   — ограничить число офферов (для локальных тестов)
 *   YML_SOURCES — какие источники включать, через запятую (по умолчанию berg:
 *                 у него реальные остатки; у armtek сток-заглушка 99999 —
 *                 такие позиции в фид не пускаем, чтобы не ронять качество)
 */

import postgres from "postgres";
import { createWriteStream, mkdirSync, renameSync, statSync } from "fs";
import { dirname, resolve } from "path";
import { CATEGORY_META } from "../lib/catalog/classifier-data.mjs";

const DB_URL = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
const SITE = "https://brocarparts.ru";
const OUT = resolve(
  process.env.YML_OUT ||
    (process.env.NODE_ENV === "production"
      ? "/app/public/feeds/yandex-market.yml"
      : "public/feeds/yandex-market.yml")
);
const LIMIT = parseInt(process.env.YML_LIMIT || "0", 10); // 0 = без лимита
const SOURCES = (process.env.YML_SOURCES || "berg")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
// Отсечка неправдоподобных цен — как isValidPrice в lib/suppliers/adapter.ts.
const MAX_PLAUSIBLE_PRICE = 10_000_000;
const FALLBACK_CATEGORY_ID = 999; // «Автозапчасти» — для товаров без категории

if (!DB_URL) {
  console.error("❌ DATABASE_URL не задан.");
  process.exit(1);
}

/** Экранирование текста для XML + вычистка управляющих символов из прайсов. */
function xml(s) {
  return String(s ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** id оффера: article-brand, только допустимые символы, ≤80 знаков. */
function offerId(article, brand) {
  return `${article}-${brand}`
    .replace(/[^A-Za-z0-9\-_.]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

const isPooler = DB_URL.includes("pooler.supabase.com");
const sql = postgres(DB_URL, {
  max: 2,
  connect_timeout: 30,
  idle_timeout: 60,
  prepare: !isPooler,
  ssl:
    DB_URL.includes("supabase.com") || DB_URL.includes("sslmode=require")
      ? "require"
      : undefined,
});

async function main() {
  const t0 = Date.now();
  console.log("🛒 Генерация YML-фида →", OUT);

  mkdirSync(dirname(OUT), { recursive: true });
  const tmp = OUT + ".tmp";
  const w = createWriteStream(tmp, { encoding: "utf8" });
  const write = (s) =>
    new Promise((res) => (w.write(s) ? res() : w.once("drain", res)));

  // Шапка. Дату фида пишем в московском поясе (форма YYYY-MM-DDTHH:MM+03:00).
  const now = new Date(Date.now() + 3 * 3600 * 1000)
    .toISOString()
    .slice(0, 16);
  await write(`<?xml version="1.0" encoding="UTF-8"?>\n`);
  await write(`<yml_catalog date="${now}+03:00">\n<shop>\n`);
  await write(`<name>BroCar</name>\n`);
  await write(`<company>ИП Бакиров Артём Олегович</company>\n`);
  await write(`<url>${SITE}</url>\n`);
  await write(`<currencies><currency id="RUR" rate="1"/></currencies>\n`);

  // Категории: id = порядковый номер в CATEGORY_META (стабилен, пока порядок
  // в справочнике не меняется) + фолбэк для неразмеченных товаров.
  const catId = new Map();
  await write(`<categories>\n`);
  CATEGORY_META.forEach((c, i) => {
    catId.set(c.slug, i + 1);
    // строки-конкатенации вместо await в forEach — буфер мелкий, поток успевает
    w.write(`<category id="${i + 1}">${xml(c.title)}</category>\n`);
  });
  w.write(
    `<category id="${FALLBACK_CATEGORY_ID}">Автозапчасти</category>\n</categories>\n`
  );
  await write(`<offers>\n`);

  // Курсор: не тащим 190k строк в память разом. Картинки подтягиваем LEFT JOIN
  // из кэша product_images (может не быть — тег <picture> тогда опускаем).
  const seen = new Set();
  let total = 0;
  let withPic = 0;

  const cursor = sql`
    SELECT p.article, p.brand, p.name, p.our_price, p.category_slug,
           pi.image_url
    FROM products p
    LEFT JOIN product_images pi
      ON pi.brand = lower(trim(p.brand))
     AND pi.article = lower(trim(p.article))
     AND pi.image_url IS NOT NULL
    WHERE p.stock > 0
      AND p.source = ANY(${SOURCES})
      AND p.brand IS NOT NULL AND p.brand <> ''
      AND p.article IS NOT NULL AND p.article <> ''
      AND p.name IS NOT NULL AND p.name <> ''
      AND p.our_price::numeric > 0
      AND p.our_price::numeric < ${MAX_PLAUSIBLE_PRICE}
    ${LIMIT > 0 ? sql`LIMIT ${LIMIT}` : sql``}
  `.cursor(2000);

  for await (const rows of cursor) {
    let chunk = "";
    for (const r of rows) {
      const id = offerId(r.article, r.brand);
      if (seen.has(id)) continue; // дубликаты article+brand в прайсах бывают
      seen.add(id);

      const price = Math.round(parseFloat(r.our_price) * 100) / 100;
      if (!Number.isFinite(price) || price <= 0) continue;

      const url = `${SITE}/product/${encodeURIComponent(r.article)}?brand=${encodeURIComponent(r.brand)}`;
      const cid = catId.get(r.category_slug) ?? FALLBACK_CATEGORY_ID;
      const name = xml(`${r.brand} ${r.article} ${r.name}`.slice(0, 250));

      chunk += `<offer id="${xml(id)}" available="true">`;
      chunk += `<url>${xml(url)}</url>`;
      chunk += `<price>${price}</price>`;
      chunk += `<currencyId>RUR</currencyId>`;
      chunk += `<categoryId>${cid}</categoryId>`;
      if (r.image_url) {
        chunk += `<picture>${xml(r.image_url)}</picture>`;
        withPic++;
      }
      chunk += `<name>${name}</name>`;
      chunk += `<vendor>${xml(r.brand)}</vendor>`;
      chunk += `<vendorCode>${xml(r.article)}</vendorCode>`;
      chunk += `</offer>\n`;
      total++;
    }
    await write(chunk);
    if (total % 20000 < 2000) console.log(`   …${total} офферов`);
  }

  await write(`</offers>\n</shop>\n</yml_catalog>\n`);
  await new Promise((res) => w.end(res));
  renameSync(tmp, OUT); // атомарно: наружу не видно полузаписанного фида

  const mb = (statSync(OUT).size / 1024 / 1024).toFixed(1);
  console.log(
    `✅ Готово: ${total} офферов (${withPic} с картинками), ${mb} МБ, ${((Date.now() - t0) / 1000).toFixed(0)}с`
  );
}

main()
  .catch((e) => {
    console.error("❌ Ошибка:", e.message || e);
    process.exitCode = 1;
  })
  .finally(() => sql.end({ timeout: 5 }));
