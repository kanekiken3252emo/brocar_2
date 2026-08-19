import "server-only";
import { client } from "@/lib/db";

/**
 * Кэш ответов Laximo на 24 часа — ТРЕБОВАНИЕ ТАРИФИКАЦИИ.
 *
 * Laximo тарифицирует вызовы по конкретному авто (ListQuickGroup, ListQuickDetail,
 * ListImageMapByUnit, GetOEMPartApplicability и т.д.). Чтобы «1 VIN считался как
 * 1 запрос в сутки» и тариф не «сожрался», данные по авто (identity: catalog +
 * vehicleid + ssd, а также дерево/детали) нужно хранить у себя и переиспользовать
 * в течение 24 часов. См. https://doc.laximo.ru/ru/general/principles.
 *
 * Храним в БД (переживает деплой; общий кэш на все инстансы). Таблица создаётся
 * сама. Кэш — некритичный путь: при любой ошибке просто работаем без него.
 */

const TTL_MS = 24 * 60 * 60 * 1000; // 24 часа

let ensured = false;
async function ensure(): Promise<void> {
  if (ensured) return;
  await client`
    CREATE TABLE IF NOT EXISTS laximo_cache (
      cache_key text PRIMARY KEY,
      value text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`;
  ensured = true;
}

async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    await ensure();
    const rows = await client<{ value: string; created_at: Date }[]>`
      SELECT value, created_at FROM laximo_cache WHERE cache_key = ${key} LIMIT 1`;
    const row = rows[0];
    if (!row) return null;
    if (Date.now() - new Date(row.created_at).getTime() > TTL_MS) return null;
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

async function cacheSet(key: string, value: unknown): Promise<void> {
  try {
    await ensure();
    await client`
      INSERT INTO laximo_cache (cache_key, value, created_at)
      VALUES (${key}, ${JSON.stringify(value)}, now())
      ON CONFLICT (cache_key)
      DO UPDATE SET value = EXCLUDED.value, created_at = now()`;
  } catch {
    // молча — без кэша тоже работает (только тариф расходуется быстрее)
  }
}

/**
 * Вернуть из кэша (не старше 24ч) или посчитать через compute() и сохранить.
 * Так каждый тарифицируемый вызов Laximo по одному авто делается не чаще раза
 * в сутки.
 */
export async function laximoCached<T>(
  key: string,
  compute: () => Promise<T>
): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== null) return hit;
  const val = await compute();
  // Пустые/невалидные результаты не кэшируем — вдруг это временный сбой.
  if (val != null && !(Array.isArray(val) && val.length === 0)) {
    await cacheSet(key, val);
  }
  return val;
}

/**
 * Дневной ПРЕДОХРАНИТЕЛЬ на платные вызовы: атомарный счётчик в той же
 * таблице. true — бюджет на сегодня ещё есть (и счётчик инкрементирован),
 * false — лимит исчерпан, вызов надо пропустить. При ошибке БД разрешаем
 * (лучше редкий лишний вызов, чем сломанный каталог).
 *
 * Появился после инцидента 17-18.08.2026: лимит DOC (10000/мес) сгорел
 * наполовину за сутки — незакэшированные пустые кроссы + боты.
 */
export async function laximoDailyBudget(
  name: string,
  dailyLimit: number
): Promise<boolean> {
  try {
    await client`
      CREATE TABLE IF NOT EXISTS laximo_cache (
        cache_key text PRIMARY KEY,
        value text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
    const key = `budget:${name}:${new Date().toISOString().slice(0, 10)}`;
    const rows = await client<{ value: string }[]>`
      INSERT INTO laximo_cache (cache_key, value, created_at)
      VALUES (${key}, '1', now())
      ON CONFLICT (cache_key)
      DO UPDATE SET value = (laximo_cache.value::int + 1)::text
      RETURNING value`;
    const used = parseInt(rows[0]?.value ?? "1", 10);
    if (used > dailyLimit) {
      if (used === dailyLimit + 1) {
        console.warn(`laximo: дневной бюджет «${name}» исчерпан (${dailyLimit})`);
      }
      return false;
    }
    return true;
  } catch {
    return true;
  }
}
