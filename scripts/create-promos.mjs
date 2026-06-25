// Создаёт таблицу promo_codes и добавляет поля скидки в carts/orders.
// Идемпотентно (IF NOT EXISTS) — безопасно запускать повторно.
// Запуск:  node scripts/create-promos.mjs   (или npm run db:promos)
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Загружаем .env.local / .env вручную (без зависимостей).
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
      // файла нет — ок
    }
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
  console.log("⚙️  Промокоды: миграция схемы…");
  console.log("   DB:", DB_URL.replace(/:[^:@]+@/, ":***@"));

  await sql`
    CREATE TABLE IF NOT EXISTS promo_codes (
      id            serial PRIMARY KEY,
      code          text NOT NULL UNIQUE,
      discount_pct  numeric NOT NULL,
      active        boolean NOT NULL DEFAULT true,
      starts_at     timestamptz,
      expires_at    timestamptz,
      created_at    timestamptz NOT NULL DEFAULT now()
    )
  `;
  console.log("   ✓ таблица promo_codes");

  await sql`ALTER TABLE carts  ADD COLUMN IF NOT EXISTS promo_code text`;
  console.log("   ✓ carts.promo_code");

  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code text`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_pct numeric`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT '0'`;
  console.log("   ✓ orders.promo_code / discount_pct / discount_amount");

  await sql.end();
  console.log("🎉 Готово");
}

main().catch((e) => {
  console.error("❌ Ошибка:", e.message || e);
  process.exit(1);
});
