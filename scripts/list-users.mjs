// Показывает зарегистрированных пользователей (таблица auth_users в VK):
// email, подтверждён ли, дата регистрации. Только чтение.
// Запуск:  docker exec brocar-app node /app/scripts/list-users.mjs
//          (или локально: node scripts/list-users.mjs)
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
  const rows = await sql`
    SELECT au.email,
           au.email_confirmed_at IS NOT NULL AS confirmed,
           au.created_at,
           p.full_name,
           p.phone,
           (SELECT count(*)::int FROM orders o WHERE o.user_id = au.id) AS orders
    FROM auth_users au
    LEFT JOIN profiles p ON p.id = au.id
    ORDER BY au.created_at DESC
  `;
  console.log(`Всего пользователей: ${rows.length}\n`);
  for (const r of rows) {
    const date = new Date(r.created_at).toLocaleString("ru-RU");
    console.log(
      `${r.confirmed ? "✅" : "⏳"} ${r.email}` +
        `${r.full_name ? "  | " + r.full_name : ""}` +
        `${r.phone ? "  | " + r.phone : ""}` +
        `  | заказов: ${r.orders}  | ${date}`
    );
  }
  await sql.end();
}
main().catch((e) => {
  console.error("❌ Ошибка:", e.message || e);
  process.exit(1);
});
