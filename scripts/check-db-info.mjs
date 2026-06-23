// Диагностика текущей БД перед переездом: версия PG, размер, расширения, таблицы.
// Запуск: node --env-file=.env.local scripts/check-db-info.mjs
import postgres from "postgres";

const url = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
const sql = postgres(url, {
  prepare: false,
  ssl: url.includes("supabase.com") ? "require" : undefined,
  max: 1,
});

try {
  const [v] = await sql`select version() as v`;
  const [size] = await sql`select pg_size_pretty(pg_database_size(current_database())) as s`;
  const ext = await sql`select extname, extversion from pg_extension order by extname`;
  const [tbls] = await sql`select count(*)::int as c from information_schema.tables where table_schema = 'public'`;
  const [rows] = await sql`select count(*)::int as c from products`;

  console.log("VERSION:", v.v);
  console.log("DB SIZE:", size.s);
  console.log("PUBLIC TABLES:", tbls.c);
  console.log("PRODUCTS ROWS:", rows.c);
  console.log("EXTENSIONS:");
  for (const e of ext) console.log("  -", e.extname, e.extversion);
} catch (e) {
  console.error("ERR:", e.message);
} finally {
  await sql.end();
}
