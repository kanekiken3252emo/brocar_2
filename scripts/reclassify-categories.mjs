#!/usr/bin/env node
/**
 * Реклассификация каталога: переприменяет detectCategory + extractAttributes ко
 * ВСЕМ товарам (после правок классификатора/экстракторов). Обновляет только
 * строки, у которых реально поменялись category_slug или attributes.
 *
 * Нужен после изменения lib/catalog/classifier-data.mjs или attributes.mjs,
 * чтобы уже импортированные товары переехали в правильные категории и получили
 * актуальные характеристики — без полного переимпорта прайсов из почты.
 *
 * Запуск (Node 22+):
 *   node --env-file=.env.local scripts/reclassify-categories.mjs
 */
import postgres from "postgres";
import { detectCategory } from "../lib/catalog/classifier-data.mjs";
import { extractAttributes } from "../lib/catalog/attributes.mjs";

const DB_URL = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("❌ Нет DATABASE_URL / DATABASE_POOLER_URL");
  process.exit(1);
}

const isPooler = DB_URL.includes("pooler.supabase.com");
const sql = postgres(DB_URL, {
  max: 4,
  idle_timeout: 30,
  connect_timeout: 30,
  ssl: DB_URL.includes("supabase.com") ? "require" : undefined,
  prepare: !isPooler,
});

// Стабильная сериализация для сравнения attributes (jsonb из БД отдаёт ключи в
// своём порядке — сортируем, чтобы не плодить ложные «изменения»).
function stable(obj) {
  const o = obj || {};
  return JSON.stringify(Object.fromEntries(Object.entries(o).sort()));
}

async function main() {
  console.log("🔁 Реклассификация каталога");
  console.log("   DB:", DB_URL.replace(/:[^:@]+@/, ":***@"));

  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS attributes JSONB`;

  const PAGE = 5000;
  let lastId = 0;
  let scanned = 0;
  let catChanged = 0;
  let attrChanged = 0;
  const catMoves = new Map(); // "from→to" -> count

  for (;;) {
    const rows = await sql`
      SELECT id, name, category_slug, attributes
      FROM products
      WHERE id > ${lastId}
      ORDER BY id
      LIMIT ${PAGE}
    `;
    if (rows.length === 0) break;
    lastId = Number(rows[rows.length - 1].id);
    scanned += rows.length;

    const updates = [];
    for (const r of rows) {
      const newCat = detectCategory(r.name);
      const newAttrs = extractAttributes(newCat, r.name);
      const catDiff = (r.category_slug || "") !== newCat;
      const attrDiff = stable(r.attributes) !== stable(newAttrs);
      if (!catDiff && !attrDiff) continue;

      if (catDiff) {
        catChanged++;
        const key = `${r.category_slug || "(null)"}→${newCat}`;
        catMoves.set(key, (catMoves.get(key) || 0) + 1);
      }
      if (attrDiff) attrChanged++;

      updates.push(
        sql`UPDATE products SET category_slug = ${newCat}, attributes = ${sql.json(newAttrs)} WHERE id = ${r.id}`
      );
    }

    if (updates.length) await Promise.all(updates);
    console.log(
      `   ..${scanned} просмотрено | смен категории ${catChanged} | смен атрибутов ${attrChanged}`
    );
  }

  console.log(`\n✓ Просмотрено: ${scanned}`);
  console.log(`✓ Сменили категорию: ${catChanged}`);
  console.log(`✓ Обновили атрибуты: ${attrChanged}`);

  const moves = [...catMoves.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
  console.log("\nТоп перемещений между категориями:");
  for (const [k, v] of moves) console.log(`   ${String(v).padStart(6)}  ${k}`);

  await sql.end();
  console.log("\n🎉 Реклассификация завершена");
}

main().catch((e) => {
  console.error("\n❌ Ошибка:", e.message || e);
  process.exit(1);
});
