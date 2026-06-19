// Создаёт таблицу stories в БД (идемпотентно, безопасно запускать повторно).
// Запуск:  node scripts/create-stories-table.mjs
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

const url = process.env.DATABASE_URL || process.env.DATABASE_POOLER_URL;
if (!url) {
  console.error("❌ Нет DATABASE_URL в .env.local");
  process.exit(1);
}

const sql = postgres(url, {
  ssl: url.includes("supabase.com") ? "require" : undefined,
  prepare: !url.includes("pooler.supabase.com"),
  max: 1,
});

try {
  await sql`
    CREATE TABLE IF NOT EXISTS stories (
      id bigserial PRIMARY KEY,
      title text,
      media_url text NOT NULL,
      media_type text NOT NULL,
      link_url text,
      duration_ms integer NOT NULL DEFAULT 5000,
      sort_order integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      expires_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS stories_active_order_idx ON stories (is_active, sort_order)`;
  console.log("✅ Таблица stories готова");
} catch (e) {
  console.error("❌ Ошибка:", e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
