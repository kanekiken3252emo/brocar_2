// Переносит пользователей из Supabase Auth (схема auth.users) в нашу таблицу
// auth_users в VK. Сохраняет ТОТ ЖЕ uuid (id) — поэтому заказы/гараж/профиль
// остаются привязаны к человеку, — и ТОТ ЖЕ bcrypt-хеш пароля (старые пароли
// продолжают подходить).
//
// Идемпотентно: ON CONFLICT (id) обновляет запись. Можно гонять повторно.
//
// Запуск (на VPS, как при переезде БД):
//   SOURCE_DB_URL="<Supabase session pooler URL>" \
//   DATABASE_POOLER_URL="<VK URL>" \
//   node scripts/migrate-auth-users.mjs
//
// SOURCE_DB_URL — строка подключения к Supabase (берётся из /var/www/brocar/.env.bak,
//   это сохранённый при переезде БД pooler-URL Supabase). Порт :6543 (transaction
//   pooler) подходит для разового SELECT.
// DATABASE_POOLER_URL — цель (VK). Если не задан, возьмётся из .env.local/.env.
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
      // нет файла — ок
    }
  }
}
loadEnv();

const SRC = process.env.SOURCE_DB_URL;
const DST = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;

if (!SRC) {
  console.error(
    "❌ Не задан SOURCE_DB_URL (строка подключения к Supabase — из .env.bak)"
  );
  process.exit(1);
}
if (!DST) {
  console.error("❌ Не задан DATABASE_POOLER_URL / DATABASE_URL (цель — VK)");
  process.exit(1);
}

const src = postgres(SRC, { ssl: "require", prepare: false }); // Supabase pooler
const dst = postgres(DST, {
  ssl: DST.includes("supabase.com") ? "require" : undefined,
  prepare: !DST.includes("pooler.supabase.com"),
});

async function main() {
  console.log("⚙️  Перенос пользователей Supabase → VK");
  console.log("   ИЗ :", SRC.replace(/:[^:@]+@/, ":***@"));
  console.log("   В  :", DST.replace(/:[^:@]+@/, ":***@"));

  // Берём только живых пользователей с email и паролем. OAuth/magic-link без
  // пароля пропускаем — войти по паролю они и так не могут (могут позже сбросить).
  const rows = await src`
    SELECT id, email, encrypted_password, email_confirmed_at, created_at
    FROM auth.users
    WHERE deleted_at IS NULL
      AND email IS NOT NULL
      AND encrypted_password IS NOT NULL
      AND encrypted_password <> ''
  `;
  console.log(`   Найдено в Supabase: ${rows.length}`);

  let migrated = 0;
  let failed = 0;
  for (const u of rows) {
    try {
      await dst`
        INSERT INTO auth_users (id, email, password_hash, email_confirmed_at, created_at)
        VALUES (
          ${u.id},
          ${String(u.email).trim().toLowerCase()},
          ${u.encrypted_password},
          ${u.email_confirmed_at},
          ${u.created_at}
        )
        ON CONFLICT (id) DO UPDATE SET
          email              = EXCLUDED.email,
          password_hash      = EXCLUDED.password_hash,
          email_confirmed_at = EXCLUDED.email_confirmed_at,
          updated_at         = now()
      `;
      migrated++;
    } catch (e) {
      failed++;
      console.error(`   ⚠ ${u.email}: ${e.message || e}`);
    }
  }

  // Сколько без пароля пропущено (для отчёта) — отдельным быстрым запросом.
  const [{ count: skipped }] = await src`
    SELECT count(*)::int AS count
    FROM auth.users
    WHERE deleted_at IS NULL
      AND (encrypted_password IS NULL OR encrypted_password = '')
  `;

  console.log("");
  console.log(`✅ Перенесено: ${migrated}`);
  if (failed) console.log(`⚠ С ошибкой: ${failed}`);
  if (skipped) console.log(`ℹ Без пароля (пропущены, смогут сбросить): ${skipped}`);

  // Сверка: сколько теперь в VK.
  const [{ count: total }] = await dst`SELECT count(*)::int AS count FROM auth_users`;
  console.log(`📦 Итого в VK auth_users: ${total}`);

  await src.end();
  await dst.end();
  console.log("🎉 Готово");
}

main().catch((e) => {
  console.error("❌ Ошибка:", e.message || e);
  process.exit(1);
});
