// Применяет миграцию order_items.supplier + order_items.delivery_days в текущей БД (VK).
// Идемпотентно (ADD COLUMN IF NOT EXISTS) — безопасно запускать повторно.
//
// Зачем: письмо магазину «Заказ ОПЛАЧЕН» строится из order_items. Полей поставщика
// и срока там не было, поэтому колонки «Поставщик» и «Срок» всегда приходили пустыми.
//
// ВАЖНО: запустить ДО деплоя нового кода — новый код пишет эти колонки при создании
// заказа, на непромигрированной БД оформление заказа упадёт.
//
// Запуск:  docker exec brocar-app node /app/scripts/migrate-order-items-supplier.mjs
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

const COLUMNS = ["supplier", "delivery_days"];

async function present() {
  const rows = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name IN ('supplier', 'delivery_days')
  `;
  return rows.map((r) => r.column_name);
}

async function main() {
  console.log("DB:", DB_URL.replace(/:[^:@]+@/, ":***@"));

  const before = await present();
  if (before.length === COLUMNS.length) {
    console.log("ℹ order_items.supplier / delivery_days уже есть — миграция применена ранее.");
  }

  await sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS supplier text`;
  await sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS delivery_days integer`;

  const after = await present();
  const missing = COLUMNS.filter((c) => !after.includes(c));
  if (missing.length) {
    console.error("❌ Не создались колонки:", missing.join(", "));
    process.exit(1);
  }
  console.log("✅ order_items.supplier и delivery_days есть — можно деплоить код.");

  await sql.end();
}

main().catch((e) => {
  console.error("❌ Ошибка:", e.message || e);
  process.exit(1);
});
