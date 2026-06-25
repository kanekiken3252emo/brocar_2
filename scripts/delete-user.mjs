// Удаляет пользователя по email (для тестов рег/сброса — освобождает email).
// Чистит: auth_tokens, корзину, гараж, профиль, auth_users. ЗАКАЗЫ НЕ трогает
// (если есть — предупредит и оставит, чтобы не терять историю продаж).
//
// Запуск:  docker exec brocar-app node /app/scripts/delete-user.mjs test@example.com
//          (локально:  node scripts/delete-user.mjs test@example.com)
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

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("❌ Укажи email:  node scripts/delete-user.mjs user@example.com");
  process.exit(1);
}

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
  const [u] = await sql`SELECT id FROM auth_users WHERE email = ${email}`;
  if (!u) {
    console.log(`Пользователь ${email} не найден — нечего удалять.`);
    await sql.end();
    return;
  }
  const id = u.id;

  const [{ count: orders }] =
    await sql`SELECT count(*)::int AS count FROM orders WHERE user_id = ${id}`;
  if (orders > 0) {
    console.log(
      `⚠ У ${email} есть заказы: ${orders}. Их НЕ удаляю (история продаж). ` +
        `Удаляю только логин/профиль/корзину/гараж — заказы останутся без привязки.`
    );
  }

  await sql`DELETE FROM auth_tokens WHERE user_id = ${id}`;
  await sql`DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = ${id})`;
  await sql`DELETE FROM carts WHERE user_id = ${id}`;
  await sql`DELETE FROM vehicles WHERE user_id = ${id}`;
  await sql`DELETE FROM profiles WHERE id = ${id}`;
  await sql`DELETE FROM auth_users WHERE id = ${id}`;

  console.log(`✅ Удалён пользователь ${email} (email снова свободен для регистрации).`);
  await sql.end();
}
main().catch((e) => {
  console.error("❌ Ошибка:", e.message || e);
  process.exit(1);
});
