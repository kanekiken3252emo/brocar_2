// Строит lib/brands/brand-map.mjs из фактических данных products.brand.
// Для каждого кластера (вариантов одного бренда) выбирает лучшее написание:
// сначала вариант с «нормальным» смешанным регистром, тай-брейк — по частоте.
// Только чтение БД. Запуск: node --env-file=.env.local scripts/build-brand-map.mjs
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { brandKey } from "../lib/brands/canonical.mjs";

// Ручные исключения: ключ → желаемое имя. Имеют приоритет над эвристикой.
// Заполняй, если автоматический выбор написания не нравится.
const OVERRIDES = {
  // landrover: "Land Rover",
};

const cs = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
const sql = postgres(cs, {
  prepare: !cs.includes("pooler.supabase.com"),
  ssl: cs.includes("supabase.com") ? "require" : undefined,
});

const hasMixedCase = (s) => /[a-zа-яё]/.test(s) && /[A-ZА-ЯЁ]/.test(s);

const rows = await sql`
  SELECT brand, COUNT(*)::int AS count
  FROM products
  WHERE brand IS NOT NULL AND brand <> ''
  GROUP BY brand
`;
await sql.end();

const clusters = new Map();
for (const r of rows) {
  const k = brandKey(r.brand);
  if (!k) continue;
  if (!clusters.has(k)) clusters.set(k, []);
  clusters.get(k).push({ brand: r.brand.trim().replace(/\s+/g, " "), count: r.count });
}

/** Выбор лучшего написания в кластере. */
function pickDisplay(variants) {
  const sorted = [...variants].sort((a, b) => b.count - a.count);
  const mixed = sorted.filter((v) => hasMixedCase(v.brand));
  return (mixed[0] || sorted[0]).brand;
}

const map = {};
let dupes = 0;
for (const [k, variants] of clusters) {
  const uniq = new Set(variants.map((v) => v.brand));
  if (OVERRIDES[k]) {
    map[k] = OVERRIDES[k];
    continue;
  }
  // В карту кладём только кластеры-дубли (>1 написания) — для остальных
  // canonicalBrand() и так вернёт корректное единственное значение.
  if (uniq.size > 1) {
    map[k] = pickDisplay(variants);
    dupes++;
  }
}

const ordered = Object.keys(map)
  .sort()
  .reduce((acc, k) => ((acc[k] = map[k]), acc), {});

const body = `// ВНИМАНИЕ: файл генерируется автоматически.
// Перегенерировать: node --env-file=.env.local scripts/build-brand-map.mjs
//
// Карта «ключ бренда → каноничное отображаемое имя». Ключ — это brandKey()
// (lowercase без пробелов/пунктуации). Покрывает только бренды, у которых в БД
// встретилось несколько вариантов написания; остальные канонизируются эвристикой.
export const BRAND_MAP = ${JSON.stringify(ordered, null, 2)};
`;

const out = fileURLToPath(new URL("../lib/brands/brand-map.mjs", import.meta.url));
await writeFile(out, body, "utf8");

console.log(`Кластеров-дублей записано в карту: ${dupes}`);
console.log(`Файл: lib/brands/brand-map.mjs`);
