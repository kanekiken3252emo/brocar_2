#!/usr/bin/env node
/**
 * Прогрев кэша картинок товаров.
 *
 *   node --env-file=.env.local scripts/warm-product-images.mjs
 *
 * Берёт из БД товары в наличии, у которых ещё НЕТ записи в product_images,
 * и по каждому дёргает /api/product-image — эндпоинт подтянет фото у поставщиков,
 * положит в наше хранилище (Supabase Storage) и закэширует URL. После этого в
 * выдаче картинка показывается мгновенно (с нашего CDN), без 3-4с на лету.
 *
 * Масштаб: всё сразу нереально (3-4с/шт + rate-limit), поэтому за один прогон
 * греем порцию (WARM_LIMIT, по умолчанию 3000), приоритет — больший остаток.
 * За несколько ночей кэш обрастает. Запускать на ночном cron после импорта.
 *
 * Параметры (env):
 *   WARM_LIMIT       — сколько товаров за прогон (по умолчанию 3000)
 *   WARM_CONCURRENCY — одновременных запросов (по умолчанию 4)
 *   WARM_BASE_URL    — база сайта (по умолчанию https://brocarparts.ru;
 *                      на самом сервере можно http://localhost:3000)
 */

import postgres from "postgres";

const DB_URL = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
const BASE = (process.env.WARM_BASE_URL || "https://brocarparts.ru").replace(/\/$/, "");
const LIMIT = parseInt(process.env.WARM_LIMIT || "3000", 10);
const CONCURRENCY = parseInt(process.env.WARM_CONCURRENCY || "4", 10);
const REQ_TIMEOUT = 20000;

if (!DB_URL) {
  console.error("❌ DATABASE_URL не задан.");
  process.exit(1);
}

const isPooler = DB_URL.includes("pooler.supabase.com");
const sql = postgres(DB_URL, {
  max: 2, idle_timeout: 30, connect_timeout: 30, ssl: "require", prepare: !isPooler,
});

async function fetchImage(brand, article) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQ_TIMEOUT);
  try {
    const url = `${BASE}/api/product-image?brand=${encodeURIComponent(brand)}&article=${encodeURIComponent(article)}`;
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const data = await res.json();
    return data.url ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  console.log("🖼️  Прогрев картинок");
  console.log(`   База: ${BASE} | порция: ${LIMIT} | параллельно: ${CONCURRENCY}`);

  // Товары в наличии, по которым картинку ещё ни разу не пробовали
  // (нет строки в product_images). Приоритет — больший остаток.
  const rows = await sql`
    SELECT p.brand AS brand, p.article AS article
    FROM products p
    WHERE p.stock > 0
      AND p.brand IS NOT NULL AND p.brand <> ''
      AND p.article IS NOT NULL AND p.article <> ''
      AND NOT EXISTS (
        SELECT 1 FROM product_images pi
        WHERE pi.brand = lower(trim(p.brand))
          AND pi.article = lower(trim(p.article))
      )
    -- Армтек-заглушку (clampStock = 99999) отправляем в конец очереди: у этих
    -- позиций сток искусственный, а среди них много мелочёвки без фото. Сначала
    -- греем товары с реальным стоком (где выше шанс найти картинку).
    ORDER BY (p.stock >= 99999), p.stock DESC
    LIMIT ${LIMIT}
  `;
  await sql.end();

  console.log(`   К прогреву: ${rows.length} товаров`);
  if (rows.length === 0) {
    console.log("✅ Нечего греть — кэш уже покрывает товары в наличии.");
    return;
  }

  let done = 0;
  let withImg = 0;
  let idx = 0;

  async function worker() {
    while (idx < rows.length) {
      const i = idx++;
      const r = rows[i];
      const url = await fetchImage(r.brand, r.article);
      done++;
      if (url) withImg++;
      if (done % 200 === 0 || done === rows.length) {
        console.log(`   ${done}/${rows.length} (с картинкой: ${withImg})`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  console.log(`\n✅ Прогрев завершён: обработано ${done}, картинок найдено ${withImg}.`);
}

main().catch((e) => {
  console.error("\n❌ Ошибка:", e.message || e);
  process.exit(1);
});
