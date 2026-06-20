import postgres from "postgres";

/**
 * Подключение к БД для bulk-импорта прайс-листов.
 *
 * Почему не обычный пулер: app использует transaction-пулер Supabase (порт 6543),
 * где `statement_timeout` жёстко = 2 мин и поднять его нельзя. Большие апсерты
 * (Форум-Авто ~379k, ШАТЕ-М) в 2 минуты не укладываются → «canceling statement
 * due to statement timeout», импорт падает.
 *
 * Решение: session-режим пулера (тот же IPv4-хост, порт 5432 вместо 6543) —
 * там `SET statement_timeout` держится на соединении. Прямое подключение
 * (db.<ref>.supabase.co:5432) НЕ используем: у Supabase оно часто IPv6-only, а
 * VPS обычно IPv4.
 *
 * max: 1 — импортёры пишут последовательно (await в цикле), поэтому одного
 * соединения достаточно, и `SET` гарантированно действует на всех запросах.
 */
export async function makeImportSql() {
  const base = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_POOLER_URL / DATABASE_URL не задан");
  // transaction-пулер (6543) → session-пулер (5432). Прямой 5432-URL оставляем как есть.
  const url = base.replace(":6543", ":5432");
  const sql = postgres(url, {
    max: 1,
    idle_timeout: 30,
    connect_timeout: 30,
    ssl: "require",
    prepare: false,
  });
  // 10 минут на один statement — с запасом для самых больших апсертов.
  await sql`SET statement_timeout = '600s'`;
  return sql;
}
