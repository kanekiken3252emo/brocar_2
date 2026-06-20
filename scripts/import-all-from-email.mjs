#!/usr/bin/env node
/**
 * Запуск ВСЕХ импортов прайс-листов из почты подряд (для ежедневного cron).
 *
 *   node --env-file=.env.local scripts/import-all-from-email.mjs
 *
 * Запускает импортёры последовательно. Падение одного поставщика НЕ останавливает
 * остальных — в конце печатается сводка. Данные пишутся прямо в БД (Supabase),
 * сайт видит их сразу, без деплоя.
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPPLIERS = [
  ["Berg", "import-berg-from-email.mjs"],
  ["ШАТЕ-М", "import-shatem-from-email.mjs"],
  ["Форум-Авто", "import-forum-from-email.mjs"],
  ["Армтек", "import-armtek-from-email.mjs"],
  ["Россико", "import-rossko-from-email.mjs"],
];

function run(script) {
  return new Promise((res) => {
    const child = spawn(process.execPath, [resolve(__dirname, script)], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("close", (code) => res(code === 0));
    child.on("error", () => res(false));
  });
}

const results = [];
for (const [name, script] of SUPPLIERS) {
  console.log(`\n================ ${name} ================`);
  const ok = await run(script);
  results.push([name, ok]);
}

// После массового импорта (ежедневный DELETE+INSERT остатков и upsert товаров)
// таблицы раздуты «мёртвыми» строками, а visibility map устаревает — из-за этого
// index-only scan каталога лезет в тысячи страниц кучи и запросы тормозят на
// секунды (на холодную). VACUUM ANALYZE чинит visibility map и обновляет
// статистику планировщика. Делаем это СРАЗУ после импорта, не дожидаясь autovacuum.
console.log("\n================ VACUUM ================");
try {
  const { makeImportSql } = await import("./import-db.mjs");
  const sql = await makeImportSql();
  for (const t of ["products", "product_stocks"]) {
    const start = Date.now();
    await sql.unsafe(`VACUUM (ANALYZE) ${t}`);
    console.log(`  ✓ ${t}: ${((Date.now() - start) / 1000).toFixed(1)}с`);
  }
  await sql.end();
} catch (e) {
  console.error("  ⚠️ VACUUM не удался:", e.message || e);
}

console.log("\n================ ИТОГ ================");
for (const [name, ok] of results) console.log(`  ${ok ? "✅" : "❌"} ${name}`);
const failed = results.filter(([, ok]) => !ok).length;
process.exit(failed > 0 ? 1 : 0);
