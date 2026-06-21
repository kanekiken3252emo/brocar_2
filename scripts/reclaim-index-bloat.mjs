// Возврат места в БД: дроп дублирующих индексов + REINDEX раздутых.
// Зачем: products/product_stocks каждую ночь полностью переписываются импортом,
// от чего btree/GIN-индексы пухнут (heap почти не растёт). VACUUM индексы НЕ чистит —
// нужен REINDEX. На Supabase Free это держит размер БД ниже / снимает overage.
//
// Запуск:  node --env-file=.env.local scripts/reclaim-index-bloat.mjs
// Идемпотентно и онлайн: DROP/REINDEX CONCURRENTLY не блокируют сайт. Можно в cron
// (напр. раз в неделю) — bloat возвращается после импортов.
import { makeImportSql } from "./import-db.mjs";

// Дублирующие/покрытые индексы — удаляем насовсем (легко вернуть через
// scripts/add-catalog-indexes.mjs при надобности):
//  • idx_products_article       — покрыт uniq_products_article_brand (article, brand)
//  • idx_product_stocks_product — точный дубль idx_product_stocks_product_id (оба product_id)
const DROP_REDUNDANT = ["idx_products_article", "idx_product_stocks_product"];

const TABLES = ["products", "product_stocks"];
const MIN_REINDEX_BYTES = 4 * 1024 * 1024; // мелкие индексы реиндексить нет смысла

const sql = await makeImportSql();
try {
  const [before] = await sql`SELECT pg_size_pretty(pg_database_size(current_database())) AS s, pg_database_size(current_database()) AS b`;
  console.log("📦 DB до:", before.s);

  for (const name of DROP_REDUNDANT) {
    try {
      process.stdout.write(`🗑️  DROP ${name}… `);
      await sql.unsafe(`DROP INDEX CONCURRENTLY IF EXISTS ${name}`);
      console.log("ok");
    } catch (e) {
      console.log("FAILED:", e.message);
    }
  }

  const idx = await sql`
    SELECT indexrelname AS name, pg_relation_size(indexrelid) AS bytes
    FROM pg_stat_user_indexes
    WHERE relname IN ${sql(TABLES)}
    ORDER BY pg_relation_size(indexrelid) DESC`;

  for (const i of idx) {
    if (Number(i.bytes) < MIN_REINDEX_BYTES) continue;
    const mb = (Number(i.bytes) / 1048576).toFixed(0);
    try {
      process.stdout.write(`🔧 REINDEX ${i.name} (${mb}MB)… `);
      await sql.unsafe(`REINDEX INDEX CONCURRENTLY ${i.name}`);
      console.log("ok");
    } catch (e) {
      console.log("FAILED:", e.message);
    }
  }

  // Подчищаем «битые» индексы, если REINDEX CONCURRENTLY где-то прервался.
  const invalid = await sql`
    SELECT c.relname FROM pg_class c
    JOIN pg_index x ON x.indexrelid = c.oid
    WHERE NOT x.indisvalid AND c.relname LIKE '%ccnew%'`;
  for (const v of invalid) {
    try { await sql.unsafe(`DROP INDEX CONCURRENTLY IF EXISTS ${v.relname}`); console.log("🧹 dropped invalid", v.relname); } catch {}
  }

  const [after] = await sql`SELECT pg_size_pretty(pg_database_size(current_database())) AS s, pg_database_size(current_database()) AS b`;
  const savedMb = ((Number(before.b) - Number(after.b)) / 1048576).toFixed(0);
  console.log(`\n📦 DB после: ${after.s}  (освобождено ~${savedMb} МБ)`);
} finally {
  await sql.end();
}
