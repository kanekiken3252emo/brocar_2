import "server-only";
import { client } from "@/lib/db";
import {
  searchAllSuppliers,
  groupOffers,
  normalizeArticle,
  type SupplierGroup,
} from "@/lib/suppliers/adapter";
import bergAdapter from "@/lib/suppliers/berg";
import rosskoAdapter from "@/lib/suppliers/rossko";
import shateMAdapter from "@/lib/suppliers/shate-m";
import forumAutoAdapter from "@/lib/suppliers/forum-auto";
import armtekAdapter from "@/lib/suppliers/armtek";
import autotradeAdapter from "@/lib/suppliers/autotrade";
import partKomAdapter from "@/lib/suppliers/partkom";
import { applyPricingSync } from "@/lib/pricing";

/**
 * Предложения ОДНОГО аналога из каталога Laximo у наших поставщиков — блок
 * «Ещё аналоги из каталога» рендерит их тем же SupplierGroupListItem, что и
 * «Аналоги в наличии» (единый формат карточек, корзина прямо из списка).
 *
 * Один вызов = опрос всех поставщиков, поэтому ОБЯЗАТЕЛЕН кэш в БД:
 * первый посетитель платит, остальные 6 часов читают из кэша. Отрицательный
 * результат («нет ни у кого», group=null) кэшируется тоже — иначе каждый
 * просмотр страницы заново молотил бы поставщиков по отсутствующим позициям.
 */

export type CrossPriceResult = {
  group: SupplierGroup | null; // null = нет у поставщиков («под заказ»)
};

const TTL_MS = 6 * 60 * 60 * 1000; // 6 часов — цены живее, чем каталог

let ensured = false;
async function ensure(): Promise<void> {
  if (ensured) return;
  await client`
    CREATE TABLE IF NOT EXISTS cross_price_cache (
      cache_key text PRIMARY KEY,
      value text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`;
  ensured = true;
}

async function cacheGet(key: string): Promise<CrossPriceResult | null> {
  try {
    await ensure();
    const rows = await client<{ value: string; created_at: Date }[]>`
      SELECT value, created_at FROM cross_price_cache WHERE cache_key = ${key} LIMIT 1`;
    const row = rows[0];
    if (!row) return null;
    if (Date.now() - new Date(row.created_at).getTime() > TTL_MS) return null;
    const parsed = JSON.parse(row.value) as CrossPriceResult;
    // Записи старого формата ({minPrice,...} без поля group) игнорируем.
    if (!("group" in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function cacheSet(key: string, value: CrossPriceResult): Promise<void> {
  try {
    await ensure();
    await client`
      INSERT INTO cross_price_cache (cache_key, value, created_at)
      VALUES (${key}, ${JSON.stringify(value)}, now())
      ON CONFLICT (cache_key)
      DO UPDATE SET value = EXCLUDED.value, created_at = now()`;
  } catch {
    // без кэша тоже работает, просто дороже
  }
}

const normBrand = (s: string) => s.replace(/[^A-Za-zА-Яа-я0-9]/g, "").toUpperCase();

export async function getCrossPrice(
  article: string,
  brand?: string
): Promise<CrossPriceResult> {
  const na = normalizeArticle(article);
  const key = `${na}|${normBrand(brand ?? "")}`;
  const hit = await cacheGet(key);
  if (hit) return hit;

  const adapters = [
    bergAdapter,
    rosskoAdapter,
    shateMAdapter,
    forumAutoAdapter,
    armtekAdapter,
    autotradeAdapter,
    partKomAdapter,
  ];
  // Ищем по артикулу без бренда: написание брендов у Laximo и поставщиков
  // расходится (MANN vs MANN-FILTER) — сузили бы выдачу до нуля. Бренд
  // сверяем сами по вхождению.
  const items = await searchAllSuppliers(adapters, { article });
  const groups = groupOffers(items, (base, ctx) => applyPricingSync(base, ctx));

  const sameArticle = groups.filter((g) => normalizeArticle(g.article) === na);
  const nb = normBrand(brand ?? "");
  const g =
    (nb &&
      sameArticle.find((x) => {
        const gb = normBrand(x.brand);
        return gb === nb || gb.includes(nb) || nb.includes(gb);
      })) ||
    sameArticle[0] ||
    null;

  const result: CrossPriceResult = { group: g || null };
  await cacheSet(key, result);
  return result;
}
