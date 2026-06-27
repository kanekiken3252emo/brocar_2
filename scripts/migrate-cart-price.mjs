// Применяет миграцию cart_items.price (снимок цены оффера) в текущей БД (VK).
// Идемпотентно (ADD COLUMN IF NOT EXISTS) — безопасно запускать повторно, и если
// колонка уже есть (накатил кто-то с рабочего ПК), просто подтвердит это.
// Запуск:  docker exec brocar-app node /app/scripts/migrate-cart-price.mjs
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
  console.log("DB:", DB_URL.replace(/:[^:@]+@/, ":***@"));

  const before = await sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cart_items' AND column_name = 'price'
  `;
  if (before.length) {
    console.log("ℹ cart_items.price уже была — миграция применена ранее.");
  }

  await sql`ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS price numeric`;

  const after = await sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cart_items' AND column_name = 'price'
  `;
  console.log(
    after.length ? "✅ cart_items.price есть — корзина/оформление в порядке." : "❌ Колонка не создалась"
  );

  await sql.end();
}

main().catch((e) => {
  console.error("❌ Ошибка:", e.message || e);
  process.exit(1);
});
