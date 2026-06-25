// Создаёт таблицы локальной авторизации (auth_users, auth_tokens) в текущей БД
// (по умолчанию — VK через DATABASE_POOLER_URL). Идемпотентно (IF NOT EXISTS) —
// безопасно запускать повторно.
// Запуск:  node scripts/create-auth-tables.mjs   (или npm run db:auth-tables)
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Грузим .env.local / .env вручную (без зависимостей).
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
  console.log("⚙️  Авторизация: миграция схемы…");
  console.log("   DB:", DB_URL.replace(/:[^:@]+@/, ":***@"));

  await sql`
    CREATE TABLE IF NOT EXISTS auth_users (
      id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email              text NOT NULL UNIQUE,
      password_hash      text NOT NULL,
      email_confirmed_at timestamptz,
      created_at         timestamptz NOT NULL DEFAULT now(),
      updated_at         timestamptz NOT NULL DEFAULT now()
    )
  `;
  console.log("   ✓ таблица auth_users");

  await sql`
    CREATE TABLE IF NOT EXISTS auth_tokens (
      id          bigserial PRIMARY KEY,
      user_id     uuid NOT NULL,
      type        text NOT NULL,
      token_hash  text NOT NULL,
      expires_at  timestamptz NOT NULL,
      used_at     timestamptz,
      created_at  timestamptz NOT NULL DEFAULT now()
    )
  `;
  console.log("   ✓ таблица auth_tokens");

  await sql`CREATE INDEX IF NOT EXISTS auth_tokens_token_hash_idx ON auth_tokens (token_hash)`;
  await sql`CREATE INDEX IF NOT EXISTS auth_tokens_user_id_idx ON auth_tokens (user_id)`;
  console.log("   ✓ индексы auth_tokens");

  await sql.end();
  console.log("🎉 Готово");
}

main().catch((e) => {
  console.error("❌ Ошибка:", e.message || e);
  process.exit(1);
});
