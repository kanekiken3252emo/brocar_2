#!/usr/bin/env node
/**
 * Backfill характеристик (products.attributes) для фасетных фильтров.
 *
 * Что делает:
 *   1. ALTER TABLE products ADD COLUMN attributes JSONB (+ GIN-индекс).
 *   2. Для категорий, у которых описаны фасеты (lib/catalog/attributes.mjs),
 *      проходит товары и заполняет attributes, извлекая значения из name.
 *
 * Идемпотентно: повторный прогон просто пересчитает значения.
 *
 * Запуск (Node 22+):
 *   node --env-file=.env.local scripts/backfill-attributes.mjs            # все категории с фасетами
 *   node --env-file=.env.local scripts/backfill-attributes.mjs engine-oils  # только одна
 */
import postgres from "postgres";
import {
  ATTRIBUTE_META,
  extractAttributes,
} from "../lib/catalog/attributes.mjs";

const DB_URL = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("❌ Нет DATABASE_URL / DATABASE_POOLER_URL в окружении");
  process.exit(1);
}

const onlyCategory = process.argv[2] || null;
const categories = Object.keys(ATTRIBUTE_META).filter(
  (slug) => !onlyCategory || slug === onlyCategory
);

if (categories.length === 0) {
  console.error(
    `❌ Нет категорий для обработки. Доступны: ${Object.keys(ATTRIBUTE_META).join(", ") || "(пусто)"}`
  );
  process.exit(1);
}

const isPooler = DB_URL.includes("pooler.supabase.com");
const sql = postgres(DB_URL, {
  max: 3,
  idle_timeout: 30,
  connect_timeout: 30,
  ssl: DB_URL.includes("supabase.com") ? "require" : undefined,
  prepare: !isPooler,
});

async function main() {
  console.log("🏷️  Backfill атрибутов товаров");
  console.log("   DB:", DB_URL.replace(/:[^:@]+@/, ":***@"));
  console.log("   Категории:", categories.join(", "));

  // 1. Миграция
  console.log("\n⚙️  Миграция схемы…");
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS attributes JSONB`;
  await sql`CREATE INDEX IF NOT EXISTS idx_products_attributes ON products USING gin(attributes)`;
  console.log("   ✓ колонка attributes + GIN-индекс");

  const BATCH = 500;

  for (const slug of categories) {
    const rows = await sql`
      SELECT id, name FROM products WHERE category_slug = ${slug}
    `;
    console.log(`\n📦 ${slug}: товаров ${rows.length}`);

    let updated = 0;
    let withAttrs = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      // Параллельные UPDATE внутри батча — postgres.js сам сериализует по пулу.
      await Promise.all(
        batch.map((r) => {
          const attrs = extractAttributes(slug, r.name);
          if (Object.keys(attrs).length > 0) withAttrs++;
          updated++;
          return sql`
            UPDATE products SET attributes = ${sql.json(attrs)} WHERE id = ${r.id}
          `;
        })
      );
      if ((i / BATCH) % 10 === 0) {
        const pct = rows.length ? ((i / rows.length) * 100).toFixed(0) : "100";
        console.log(`   ..${i}/${rows.length} (${pct}%)`);
      }
    }
    console.log(
      `   ✓ обновлено ${updated}, с распознанными атрибутами: ${withAttrs} (${
        rows.length ? ((withAttrs / rows.length) * 100).toFixed(0) : 0
      }%)`
    );

    // Сводка по каждому фасету: топ-значения
    for (const meta of ATTRIBUTE_META[slug]) {
      const top = await sql`
        SELECT attributes->>${meta.key} AS value, COUNT(*)::int AS count
        FROM products
        WHERE category_slug = ${slug}
          AND stock > 0
          AND attributes ? ${meta.key}
        GROUP BY value
        ORDER BY count DESC
        LIMIT 12
      `;
      console.log(`     • ${meta.label} (${meta.key}):`);
      for (const t of top) {
        console.log(`         ${String(t.value).padEnd(18)} ${t.count}`);
      }
    }
  }

  await sql.end();
  console.log("\n🎉 Backfill завершён");
}

main().catch((e) => {
  console.error("\n❌ Ошибка:", e.message || e);
  process.exit(1);
});
