#!/usr/bin/env node
// Идемпотентно создаёт постоянный серверный кэш предложений карточки.
// Запуск: node --env-file=.env.local scripts/create-product-offer-snapshots.mjs
import postgres from "postgres";

const url = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("❌ Нет DATABASE_POOLER_URL / DATABASE_URL");
  process.exit(1);
}

const isPooler = url.includes("pooler.supabase.com");
const sql = postgres(url, {
  ssl:
    url.includes("supabase.com") || url.includes("sslmode=require")
      ? "require"
      : undefined,
  prepare: !isPooler,
  max: 1,
  connect_timeout: 15,
});

try {
  await sql`
    CREATE TABLE IF NOT EXISTS product_offer_snapshots (
      id bigserial PRIMARY KEY,
      article_norm text NOT NULL,
      brand_key text NOT NULL,
      article text NOT NULL,
      brand text NOT NULL,
      group_data jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS product_offer_snapshots_identity_idx
    ON product_offer_snapshots (article_norm, brand_key)
  `;
  console.log("✅ Таблица product_offer_snapshots готова");
} catch (error) {
  console.error("❌ Ошибка:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
