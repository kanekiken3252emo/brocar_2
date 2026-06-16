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

console.log("\n================ ИТОГ ================");
for (const [name, ok] of results) console.log(`  ${ok ? "✅" : "❌"} ${name}`);
const failed = results.filter(([, ok]) => !ok).length;
process.exit(failed > 0 ? 1 : 0);
