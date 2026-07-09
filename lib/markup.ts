import "server-only";
import postgres from "postgres";
import { client } from "@/lib/db";

/**
 * Единая наценка магазина — редактируется из админки (/admin/pricing).
 *
 * Источник правды: строка app_settings.markup_pct (проценты, напр. "38").
 * Таблица key-value создаётся сама (CREATE TABLE IF NOT EXISTS) при первом
 * обращении — отдельная миграция на проде не нужна.
 *
 * Три потребителя одного и того же процента:
 *  1. Живые цены карточек/поиска — applyPricingSync (горячий путь, синхронный):
 *     читает КЭШ этого модуля (getMarkupMultiplier), а не БД на каждый оффер.
 *  2. Импортёры прайсов (scripts/import-*.mjs) — читают app_settings напрямую
 *     через scripts/markup.mjs, чтобы ночной каталог пересобирался с той же %.
 *  3. Пересчёт уже лежащих в БД цен (repriceCatalog) — по кнопке в админке.
 */

const DEFAULT_PCT = 38;
const CACHE_TTL_MS = 60_000;

/** proc% (38) → множитель (1.38). */
export function pctToMult(pct: number): number {
  return 1 + pct / 100;
}

// ── Горячий кэш множителя (для синхронного applyPricingSync) ────────────────
let cachedMult = pctToMult(DEFAULT_PCT);
let cachedAt = 0;
let refreshing: Promise<void> | null = null;

/**
 * Синхронно вернуть текущий множитель наценки для живых цен. Раз в CACHE_TTL_MS
 * в фоне (stale-while-revalidate) обновляет значение из БД — сам вызов никогда
 * не ждёт БД (горячий путь: зовётся на каждый оффер в groupOffers).
 */
export function getMarkupMultiplier(): number {
  if (Date.now() - cachedAt > CACHE_TTL_MS && !refreshing) {
    refreshing = refreshMarkupCache().finally(() => {
      refreshing = null;
    });
  }
  return cachedMult;
}

/** Принудительно перечитать наценку из БД в кэш (зовём после сохранения в админке). */
export async function refreshMarkupCache(): Promise<void> {
  try {
    const pct = await readMarkupPct();
    cachedMult = pctToMult(pct);
    cachedAt = Date.now();
  } catch {
    // БД недоступна/таблицы ещё нет — оставляем прежний кэш (или дефолт).
    cachedAt = Date.now();
  }
}

// ── Хранилище (app_settings) ────────────────────────────────────────────────

/** Создаёт key-value таблицу настроек и сеет дефолтную наценку. Идемпотентно. */
export async function ensureSettings(): Promise<void> {
  await client`
    CREATE TABLE IF NOT EXISTS app_settings (
      key text PRIMARY KEY,
      value text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`;
  await client`
    INSERT INTO app_settings (key, value)
    VALUES ('markup_pct', ${String(DEFAULT_PCT)})
    ON CONFLICT (key) DO NOTHING`;
}

async function readSetting(key: string): Promise<string | null> {
  try {
    const rows = await client<{ value: string }[]>`
      SELECT value FROM app_settings WHERE key = ${key} LIMIT 1`;
    return rows[0]?.value ?? null;
  } catch {
    return null; // таблицы может ещё не быть
  }
}

async function writeSetting(key: string, value: string): Promise<void> {
  await client`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (${key}, ${value}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}

/** Текущая наценка в процентах (дефолт 38, если не задана/таблицы нет). */
export async function readMarkupPct(): Promise<number> {
  const raw = await readSetting("markup_pct");
  const n = raw == null ? NaN : parseFloat(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_PCT;
}

/** Валиден ли введённый процент наценки (0–300%). */
export function isValidPct(pct: number): boolean {
  return Number.isFinite(pct) && pct >= 0 && pct <= 300;
}

/** Сохранить новую наценку и сразу обновить горячий кэш живых цен. */
export async function setMarkupPct(pct: number): Promise<void> {
  await ensureSettings();
  await writeSetting("markup_pct", String(pct));
  await refreshMarkupCache();
}

// ── Статус пересчёта каталога (для индикатора в админке) ────────────────────

export type RepriceStatus = {
  state: "idle" | "running" | "done" | "error";
  progress: string; // человекочитаемо: «товары 500000/2300000»
  finishedAt: string | null;
};

export async function readRepriceStatus(): Promise<RepriceStatus> {
  const [state, progress, finishedAt] = await Promise.all([
    readSetting("reprice_state"),
    readSetting("reprice_progress"),
    readSetting("reprice_at"),
  ]);
  return {
    state: (state as RepriceStatus["state"]) || "idle",
    progress: progress || "",
    finishedAt: finishedAt || null,
  };
}

// ── Пересчёт цен в БД под текущую наценку ───────────────────────────────────

// Один процесс = один контейнер: гард в памяти не даёт запустить пересчёт дважды.
let repriceRunning = false;
const MAX_PLAUSIBLE_PRICE = 50_000_000; // как isValidPrice — отсекает NaN/баркоды
const ID_STEP = 100_000; // размер чанка по id (короткие локи, есть прогресс)

/**
 * Пересчитывает our_price = ROUND(supplier_price × множитель) во всём каталоге
 * (products + product_stocks), чанками по id. Ручные товары (source='manual')
 * не трогает. Работает на ОТДЕЛЬНОМ соединении БЕЗ statement_timeout — большой
 * UPDATE не должен убиваться 15-секундным лимитом основного пула и не занимает
 * его соединения (иначе весь сайт встаёт). Прогресс пишет в app_settings.
 *
 * Запускается «в фоне» из админ-роута (не ждём завершения в HTTP-запросе).
 */
export async function repriceCatalog(): Promise<void> {
  if (repriceRunning) return;
  repriceRunning = true;

  const connectionString =
    process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL!;
  const isPooler = connectionString.includes("pooler.supabase.com");
  const sql = postgres(connectionString, {
    max: 1,
    prepare: !isPooler,
    ssl:
      connectionString.includes("supabase.com") ||
      connectionString.includes("sslmode=require")
        ? "require"
        : undefined,
    connect_timeout: 15,
    // НАМЕРЕННО без connection.statement_timeout: пересчёт длится минуты.
  });

  const setState = (state: string, progress: string) =>
    Promise.all([
      writeSetting("reprice_state", state),
      writeSetting("reprice_progress", progress),
    ]).catch(() => {});

  try {
    await ensureSettings();
    const pct = await readMarkupPct();
    const mult = pctToMult(pct);
    await setState("running", "подготовка…");

    // products
    const [{ max: maxProd }] = await sql<{ max: number }[]>`
      SELECT COALESCE(max(id), 0)::bigint AS max FROM products`;
    for (let lo = 0; lo < maxProd; lo += ID_STEP) {
      await sql`
        UPDATE products
        SET our_price = ROUND(supplier_price::numeric * ${mult})
        WHERE id > ${lo} AND id <= ${lo + ID_STEP}
          AND supplier_price::numeric > 0
          AND supplier_price::numeric < ${MAX_PLAUSIBLE_PRICE}
          AND (source IS NULL OR source <> 'manual')
          AND our_price::numeric IS DISTINCT FROM ROUND(supplier_price::numeric * ${mult})`;
      await setState(
        "running",
        `товары ${Math.min(lo + ID_STEP, maxProd)}/${maxProd}`
      );
    }

    // product_stocks
    const [{ max: maxStock }] = await sql<{ max: number }[]>`
      SELECT COALESCE(max(id), 0)::bigint AS max FROM product_stocks`;
    for (let lo = 0; lo < maxStock; lo += ID_STEP) {
      await sql`
        UPDATE product_stocks
        SET our_price = ROUND(supplier_price::numeric * ${mult})
        WHERE id > ${lo} AND id <= ${lo + ID_STEP}
          AND supplier_price::numeric > 0
          AND supplier_price::numeric < ${MAX_PLAUSIBLE_PRICE}
          AND our_price::numeric IS DISTINCT FROM ROUND(supplier_price::numeric * ${mult})`;
      await setState(
        "running",
        `остатки ${Math.min(lo + ID_STEP, maxStock)}/${maxStock}`
      );
    }

    await Promise.all([
      writeSetting("reprice_state", "done"),
      writeSetting("reprice_progress", `наценка ${pct}% применена ко всему каталогу`),
      writeSetting("reprice_at", new Date().toISOString()),
    ]).catch(() => {});
  } catch (e) {
    console.error("repriceCatalog error:", e);
    await setState("error", e instanceof Error ? e.message : "ошибка пересчёта");
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
    repriceRunning = false;
  }
}

export function isRepriceRunning(): boolean {
  return repriceRunning;
}
