#!/usr/bin/env node
/**
 * Единовременный пересчёт цен в БД под ЕДИНУЮ наценку 38% (июль 2026).
 * Обновляет our_price = ROUND(supplier_price * 1.38) в products и product_stocks,
 * чтобы каталог не ждал ночного импорта (сами импортёры уже считают 38%).
 *
 * По умолчанию — DRY RUN (только показывает, что изменится).
 * Применить: добавить флаг --apply.
 *
 * Локально:  node --env-file=.env.local scripts/reprice-flat38.mjs [--apply]
 * На проде:  docker cp /var/www/brocar/scripts/. brocar-app:/app/scripts
 *            docker exec -u root brocar-app node /app/scripts/reprice-flat38.mjs --apply
 *
 * Ручные товары (source='manual') не трогаем — у них цена может быть выставлена
 * руками. Мусорные цены (NaN/баркоды >50 млн) исключены условием диапазона:
 * в Postgres NaN больше любого числа, поэтому верхняя граница отсекает и его.
 */

import postgres from "postgres";
import { loadMarkupMultiplier } from "./markup.mjs";

const APPLY = process.argv.includes("--apply");
let MULT = 1.38; // переопределяется наценкой из app_settings в main()
const MAX = 50_000_000;

const DB_URL = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("❌ DATABASE_URL не задан.");
  process.exit(1);
}

const isPooler = DB_URL.includes("pooler.supabase.com");
const sql = postgres(DB_URL, {
  max: 2,
  connect_timeout: 30,
  prepare: !isPooler,
  ssl:
    DB_URL.includes("supabase.com") || DB_URL.includes("sslmode=require")
      ? "require"
      : undefined,
});

// Валидная закупочная цена + цена реально изменится + не ручной товар.
const prodCond = sql`
  supplier_price::numeric > 0 AND supplier_price::numeric < ${MAX}
  AND our_price::numeric IS DISTINCT FROM ROUND(supplier_price::numeric * ${MULT})
  AND (source IS NULL OR source <> 'manual')
`;
const stockCond = sql`
  supplier_price::numeric > 0 AND supplier_price::numeric < ${MAX}
  AND our_price::numeric IS DISTINCT FROM ROUND(supplier_price::numeric * ${MULT})
`;

async function main() {
  MULT = await loadMarkupMultiplier(sql);
  console.log(`   наценка из настроек: ${Math.round((MULT - 1) * 100)}%`);

  const [{ n: nProd }] =
    await sql`SELECT count(*)::int AS n FROM products WHERE ${prodCond}`;
  const [{ n: nStock }] =
    await sql`SELECT count(*)::int AS n FROM product_stocks WHERE ${stockCond}`;

  console.log(
    `${APPLY ? "🔧 ПРИМЕНЯЮ" : "👀 DRY RUN (без --apply ничего не меняю)"}: наценка → единые ${((MULT - 1) * 100).toFixed(0)}%`
  );
  console.log(`   products к обновлению:       ${nProd}`);
  console.log(`   product_stocks к обновлению: ${nStock}`);

  const sample = await sql`
    SELECT brand, article, supplier_price, our_price,
           ROUND(supplier_price::numeric * ${MULT}) AS new_price
    FROM products WHERE ${prodCond} LIMIT 5`;
  for (const r of sample) {
    console.log(
      `   пример: ${r.brand} ${r.article}: закупка ${r.supplier_price} → было ${r.our_price}, станет ${r.new_price}`
    );
  }

  if (!APPLY) return;

  const t0 = Date.now();
  const r1 = await sql`
    UPDATE products
    SET our_price = ROUND(supplier_price::numeric * ${MULT})
    WHERE ${prodCond}`;
  console.log(`✅ products: обновлено ${r1.count}`);
  const r2 = await sql`
    UPDATE product_stocks
    SET our_price = ROUND(supplier_price::numeric * ${MULT})
    WHERE ${stockCond}`;
  console.log(
    `✅ product_stocks: обновлено ${r2.count} (${((Date.now() - t0) / 1000).toFixed(0)}с)`
  );
}

main()
  .catch((e) => {
    console.error("❌ Ошибка:", e.message || e);
    process.exitCode = 1;
  })
  .finally(() => sql.end({ timeout: 5 }));
