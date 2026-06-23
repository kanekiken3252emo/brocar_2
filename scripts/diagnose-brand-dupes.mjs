// Диагностика дублей брендов: группирует значения products.brand по
// «агрессивному» ключу (lowercase, без пробелов/пунктуации) и показывает
// кластеры, где одному ключу соответствует >1 варианта написания.
// Только чтение. Запуск: node --env-file=.env.local scripts/diagnose-brand-dupes.mjs
import postgres from "postgres";

const cs = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
const sql = postgres(cs, {
  prepare: !cs.includes("pooler.supabase.com"),
  ssl: cs.includes("supabase.com") ? "require" : undefined,
});

const key = (s) =>
  (s || "").toLowerCase().replace(/[^0-9a-zа-яё]/g, "");

const rows = await sql`
  SELECT brand, COUNT(*)::int AS count
  FROM products
  WHERE brand IS NOT NULL AND brand <> ''
  GROUP BY brand
`;

const clusters = new Map();
for (const r of rows) {
  const k = key(r.brand);
  if (!k) continue;
  if (!clusters.has(k)) clusters.set(k, []);
  clusters.get(k).push({ brand: r.brand, count: r.count });
}

const dupes = [...clusters.entries()]
  .filter(([, v]) => v.length > 1)
  .map(([k, v]) => ({
    key: k,
    total: v.reduce((s, x) => s + x.count, 0),
    variants: v.sort((a, b) => b.count - a.count),
  }))
  .sort((a, b) => b.total - a.total);

console.log(`Всего различных значений brand: ${rows.length}`);
console.log(`Кластеров с дублями (один бренд — разные написания): ${dupes.length}\n`);

for (const d of dupes.slice(0, 60)) {
  const v = d.variants
    .map((x) => `"${x.brand}" (${x.count})`)
    .join("  ·  ");
  console.log(`[${d.total}] ${v}`);
}

await sql.end();
