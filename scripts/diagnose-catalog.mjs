// Диагностика скорости каталога: прогоняет ПО ОТДЕЛЬНОСТИ каждый запрос, который
// делает роут /api/catalog/category/[slug], и печатает время каждого + план
// (EXPLAIN ANALYZE) для самых подозрительных. Так видно, что именно тормозит:
// остатки (product_stocks), подсчёт, фасеты или просто сеть до Supabase.
//
// Запуск:  node --env-file=.env.local scripts/diagnose-catalog.mjs [slug]
//          (по умолчанию slug = engine-oils)
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    try {
      const txt = readFileSync(resolve(process.cwd(), f), "utf8");
      for (const line of txt.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
        if (m && !process.env[m[1]]) {
          let v = m[2].trim();
          if (
            (v.startsWith('"') && v.endsWith('"')) ||
            (v.startsWith("'") && v.endsWith("'"))
          ) {
            v = v.slice(1, -1);
          }
          process.env[m[1]] = v;
        }
      }
    } catch {
      /* нет файла — ок */
    }
  }
}
loadEnv();

const url = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("❌ Нет DATABASE_POOLER_URL / DATABASE_URL в .env.local");
  process.exit(1);
}
const usingPooler = url.includes("pooler.supabase.com");
const sql = postgres(url, {
  ssl: url.includes("supabase.com") ? "require" : undefined,
  prepare: !usingPooler,
  max: 1,
  idle_timeout: 20,
  connect_timeout: 15,
});

const SLUG = process.argv[2] || process.env.SLUG || "engine-oils";
// Фасетные ключи engine-oils (как в lib/catalog/attributes). Для других
// категорий жидкостей при желании поменяй вручную.
const FACET_KEYS =
  SLUG === "engine-oils"
    ? ["oil_type", "viscosity", "volume"]
    : [];

async function timed(label, run) {
  const t = Date.now();
  let rows;
  try {
    rows = await run();
  } catch (e) {
    console.log(`  ${label.padEnd(34)} ❌ ${e.message}`);
    return { ms: -1, rows: [] };
  }
  const ms = Date.now() - t;
  const flag = ms > 400 ? "  ⬅️ ДОЛГО" : "";
  console.log(`  ${label.padEnd(34)} ${String(ms).padStart(6)} ms${flag}`);
  return { ms, rows };
}

async function main() {
  console.log(`\n🔌 Подключение: ${usingPooler ? "pooler (6543)" : "direct (5432)"}`);
  console.log(`📂 Категория: ${SLUG}\n`);

  // Прогрев соединения, чтобы стоимость коннекта не легла на первый запрос.
  await timed("warmup (SELECT 1)", () => sql`SELECT 1`);
  console.log("");

  const totalStart = Date.now();

  const { rows: productRows } = await timed("1. productRows (страница, 20)", () =>
    sql`
      SELECT id, article, brand, name, our_price, supplier_price, stock
      FROM products
      WHERE category_slug = ${SLUG} AND stock > 0
      ORDER BY our_price ASC
      LIMIT 20 OFFSET 0
    `
  );

  await timed("2. count (COUNT * stock>0)", () =>
    sql`SELECT COUNT(*)::int AS count FROM products WHERE category_slug = ${SLUG} AND stock > 0`
  );

  await timed("3. brandRows (DISTINCT brand)", () =>
    sql`SELECT DISTINCT brand FROM products WHERE category_slug = ${SLUG} AND stock > 0`
  );

  for (const key of FACET_KEYS) {
    await timed(`4. facet ${key}`, () =>
      sql`
        SELECT (attributes ->> ${key}) AS value, COUNT(*)::int AS count
        FROM products
        WHERE category_slug = ${SLUG} AND stock > 0
          AND (attributes ->> ${key}) IS NOT NULL
        GROUP BY 1
      `
    );
  }

  const ids = productRows.map((p) => Number(p.id));
  await timed("5. stockRows (остатки по 20 id)", () =>
    ids.length
      ? sql`SELECT * FROM product_stocks WHERE product_id IN ${sql(ids)}`
      : Promise.resolve([])
  );

  const totalMs = Date.now() - totalStart;
  console.log(`\n  ИТОГО последовательно: ${totalMs} ms`);
  console.log(
    `  (роут часть из них шлёт параллельно, но сумма показывает вес каждого)\n`
  );

  // ── Планы запросов: использует ли индекс остатки и подсчёт ──────────────
  console.log("🔍 EXPLAIN ANALYZE — остатки (главный подозреваемый):");
  if (ids.length) {
    const plan = await sql.unsafe(
      `EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT * FROM product_stocks WHERE product_id IN (${ids.join(",")})`
    );
    for (const r of plan) console.log("   " + r["QUERY PLAN"]);
    const txt = plan.map((r) => r["QUERY PLAN"]).join("\n");
    console.log(
      txt.includes("Seq Scan on product_stocks")
        ? "   ⚠️ SEQ SCAN — индекс НЕ используется!"
        : "   ✅ Индекс по product_id используется."
    );
  }

  console.log("\n🔍 EXPLAIN ANALYZE — count (stock>0):");
  const plan2 = await sql.unsafe(
    `EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT COUNT(*) FROM products WHERE category_slug = '${SLUG.replace(/'/g, "''")}' AND stock > 0`
  );
  for (const r of plan2) console.log("   " + r["QUERY PLAN"]);

  await sql.end();
  console.log("\n✅ Готово.");
}

main().catch((e) => {
  console.error("\n❌ Ошибка:", e.message || e);
  process.exit(1);
});
