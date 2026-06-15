#!/usr/bin/env node
/**
 * Включает нечёткий поиск (опечатки, «вы имели в виду») для каталога.
 *
 * Запуск (Node 22+):
 *   node --env-file=.env.local scripts/enable-fuzzy-search.mjs
 *
 * Что делает (идемпотентно):
 *   1. CREATE EXTENSION pg_trgm — триграммное сходство (similarity/word_similarity)
 *      и быстрые LIKE '%...%' по триграммным GIN-индексам.
 *   2. Функциональные GIN-индексы по нормализованному названию и артикулу,
 *      чтобы и обычный, и фаззи-поиск шли по индексу, а не по seq scan.
 *
 * До запуска этого скрипта поиск работает в режимах exact/relaxed
 * (нормализация + синонимы), но БЕЗ фаззи-тира. После — включается Tier 3
 * («вы имели в виду»). См. app/api/catalog/text-search/route.ts.
 *
 * ВНИМАНИЕ: выражение translate(...) ОБЯЗАНО совпадать символ-в-символ с
 * FOLD_FROM/FOLD_TO в lib/catalog/normalize.ts и NAME_NORM в text-search route,
 * иначе индекс не будет использоваться.
 */

import postgres from "postgres";

const DB_URL = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;

if (!DB_URL) {
  console.error(
    "❌ DATABASE_URL / DATABASE_POOLER_URL отсутствует. Запуск: node --env-file=.env.local scripts/enable-fuzzy-search.mjs"
  );
  process.exit(1);
}

// Должно совпадать с lib/catalog/normalize.ts (FOLD_FROM / FOLD_TO).
const FOLD_FROM = "ёabcehkmoptxy";
const FOLD_TO = "еавсенкмортху";

const isPooler = DB_URL.includes("pooler.supabase.com");
const sql = postgres(DB_URL, {
  max: 3,
  idle_timeout: 30,
  connect_timeout: 30,
  ssl: "require",
  prepare: !isPooler,
});

async function step(label, fn) {
  process.stdout.write(`⚙️  ${label}… `);
  try {
    await fn();
    console.log("ok");
    return true;
  } catch (e) {
    console.log("FAILED");
    console.error("   ", e.message);
    return false;
  }
}

async function main() {
  console.log("🔎 Включение нечёткого поиска");
  console.log("   DB:", DB_URL.replace(/:[^:@]+@/, ":***@"));

  const ext = await step("CREATE EXTENSION pg_trgm", async () => {
    await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
  });

  if (!ext) {
    console.error(
      "\n⚠️  Не удалось создать расширение pg_trgm. Скорее всего у роли нет прав.\n" +
        "   Включите его вручную в Supabase: SQL Editor → CREATE EXTENSION IF NOT EXISTS pg_trgm;\n" +
        "   затем перезапустите этот скрипт для создания индексов."
    );
  }

  await step("GIN trgm индекс по названию", async () => {
    await sql.unsafe(
      `CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products ` +
        `USING gin (translate(lower(name), '${FOLD_FROM}', '${FOLD_TO}') gin_trgm_ops)`
    );
  });

  await step("GIN trgm индекс по артикулу", async () => {
    await sql.unsafe(
      `CREATE INDEX IF NOT EXISTS idx_products_article_trgm ON products ` +
        `USING gin (lower(article) gin_trgm_ops)`
    );
  });

  await sql.end();
  console.log("\n✅ Готово. Фаззи-поиск активен (Tier 3 «вы имели в виду»).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
