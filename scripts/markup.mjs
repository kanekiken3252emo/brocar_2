/**
 * Чтение единой наценки магазина из БД (app_settings.markup_pct) для импортёров
 * прайсов. Тот же источник правды, что у сайта (lib/markup.ts) — чтобы ночной
 * каталог пересобирался с наценкой, выставленной в админке.
 *
 * Использование в импортёре (уже есть открытый postgres-клиент `sql`):
 *   import { loadMarkupMultiplier } from "./markup.mjs";
 *   const MULT = await loadMarkupMultiplier(sql);   // напр. 1.38
 *   const ourPrice = Math.round(supplierPrice * MULT);
 *
 * Если таблицы/строки ещё нет или значение битое — возвращает дефолт 1.38 (38%).
 */
const DEFAULT_MULT = 1.38;

export async function loadMarkupMultiplier(sql) {
  try {
    const rows = await sql`
      SELECT value FROM app_settings WHERE key = 'markup_pct' LIMIT 1`;
    const pct = rows[0]?.value != null ? parseFloat(rows[0].value) : NaN;
    if (Number.isFinite(pct) && pct >= 0 && pct <= 300) return 1 + pct / 100;
  } catch {
    // таблицы может ещё не быть (админку ни разу не открывали) — дефолт
  }
  return DEFAULT_MULT;
}
