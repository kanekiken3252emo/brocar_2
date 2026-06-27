// Чистит negative-cache картинок (product_images с image_url IS NULL) — чтобы
// поражённые товары переподтянули фото при следующем заходе/прогреве.
// Запускать ПОСЛЕ восстановления ShATE-M.
//
// По умолчанию — DRY (только показывает, сколько удалится). Удаляет с --apply.
// Берёт только записи за окно сбоя (--days=N, по умолчанию 14), чтобы не сбрасывать
// весь исторический «честно нет картинки» каталог. --all — снять окно (все NULL).
//
// Примеры:
//   docker exec brocar-app node /app/scripts/reset-image-cache.mjs            # превью за 14 дней
//   docker exec brocar-app node /app/scripts/reset-image-cache.mjs --days=7   # превью за 7 дней
//   docker exec brocar-app node /app/scripts/reset-image-cache.mjs --apply    # удалить за 14 дней
//   docker exec brocar-app node /app/scripts/reset-image-cache.mjs --all --apply  # удалить ВСЕ NULL
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
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
            v = v.slice(1, -1);
          process.env[m[1]] = v;
        }
      }
    } catch {}
  }
}
loadEnv();

const APPLY = process.argv.includes("--apply");
const ALL = process.argv.includes("--all");
const daysArg = process.argv.find((a) => a.startsWith("--days="));
const days = daysArg ? parseInt(daysArg.split("=")[1], 10) : 14;

const DB_URL = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("❌ Нет DATABASE_URL / DATABASE_POOLER_URL");
  process.exit(1);
}
const sql = postgres(DB_URL, {
  ssl: DB_URL.includes("supabase.com") ? "require" : undefined,
  prepare: !DB_URL.includes("pooler.supabase.com"),
});

async function main() {
  const cond = ALL
    ? sql`image_url IS NULL`
    : sql`image_url IS NULL AND created_at > now() - make_interval(days => ${days})`;

  const [{ count }] =
    await sql`SELECT count(*)::int AS count FROM product_images WHERE ${cond}`;
  const [{ total }] =
    await sql`SELECT count(*)::int AS total FROM product_images WHERE image_url IS NULL`;

  console.log(`Окно: ${ALL ? "ВСЕ" : `последние ${days} дн.`}`);
  console.log(`Под удаление (negative-cache): ${count}`);
  console.log(`Всего записей image_url IS NULL: ${total}`);

  if (!APPLY) {
    console.log("\nDRY-режим — ничего не удалено. Добавь --apply, чтобы удалить.");
    await sql.end();
    return;
  }

  const res = await sql`DELETE FROM product_images WHERE ${cond}`;
  console.log(`\n✅ Удалено: ${res.count}. Эти товары переподтянут картинку при следующем заходе/прогреве.`);
  await sql.end();
}

main().catch((e) => {
  console.error("❌ Ошибка:", e.message || e);
  process.exit(1);
});
