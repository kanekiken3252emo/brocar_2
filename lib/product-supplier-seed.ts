import "server-only";
import { unstable_cache } from "next/cache";
import {
  groupOffers,
  mergeFamilyGroups,
  normalizeArticle,
  searchAllSuppliers,
  type SupplierAdapter,
  type SupplierGroup,
  type SupplierItem,
} from "@/lib/suppliers/adapter";
import { brandKey, canonicalBrand } from "@/lib/brands/canonical.mjs";
import { sameBrandFamily } from "@/lib/brands/families.mjs";
import bergAdapter from "@/lib/suppliers/berg";
import rosskoAdapter from "@/lib/suppliers/rossko";
import shateMAdapter, { ShateMAdapter } from "@/lib/suppliers/shate-m";
import forumAutoAdapter from "@/lib/suppliers/forum-auto";
import armtekAdapter from "@/lib/suppliers/armtek";
import autotradeAdapter from "@/lib/suppliers/autotrade";
import partKomAdapter from "@/lib/suppliers/partkom";
import { applyPricingSync } from "@/lib/pricing";

export interface ProductSupplierSeed {
  mainGroups: SupplierGroup[];
  shateArticleId: number | null;
}

export type ProductExistenceVerification =
  | { status: "found"; group: SupplierGroup }
  | { status: "missing"; group: null }
  | { status: "unavailable"; group: null };

/**
 * Двухминутный снимок живого поиска только для серверного SEO-шелла. Клиентский
 * API использует отдельный свежий опрос ниже: коммерческие данные на экране не
 * должны зависеть от отложенного обновления Next Data Cache.
 */
const adapters = [
  bergAdapter,
  rosskoAdapter,
  shateMAdapter,
  forumAutoAdapter,
  armtekAdapter,
  autotradeAdapter,
  partKomAdapter,
];

const PRODUCT_EXISTENCE_TIMEOUT_MS = 9_000;

async function searchAdapterForExistence(
  adapter: SupplierAdapter,
  article: string,
  brand: string
): Promise<{ available: boolean; items: SupplierItem[] }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("Supplier existence check timeout")),
        PRODUCT_EXISTENCE_TIMEOUT_MS
      );
    });
    const items = await Promise.race([
      adapter.search({
        article,
        preferredBrand: brand,
        withCrosses: false,
      }),
      timeout,
    ]);
    return { available: true, items };
  } catch {
    return { available: false, items: [] };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Консервативная серверная проверка неизвестной карточки. Положительного ответа
 * одного поставщика достаточно, чтобы сохранить реальный supplier-only товар.
 * Отсутствие считаем подтверждённым только когда ответили все интеграции: при
 * таймауте или внешнем сбое возвращаем unavailable, чтобы не создать ложную 404.
 */
async function verifyFreshProductExistence(
  article: string,
  brand: string
): Promise<ProductExistenceVerification> {
  const results = await Promise.all(
    adapters.map((adapter) =>
      searchAdapterForExistence(adapter, article, brand)
    )
  );
  const items = results.flatMap((result) => result.items);
  const groups = mergeFamilyGroups(
    groupOffers(items, (base, ctx) => applyPricingSync(base, ctx))
  );
  const group = pickMainProductGroup(groups, article, brand);

  if (group) return { status: "found", group };
  if (results.every((result) => result.available)) {
    return { status: "missing", group: null };
  }
  return { status: "unavailable", group: null };
}

const loadProductExistenceVerification = unstable_cache(
  verifyFreshProductExistence,
  ["product-existence-verification-v1"],
  { revalidate: 120 }
);

export async function getProductExistenceVerification(
  article: string,
  brand: string
): Promise<ProductExistenceVerification> {
  return loadProductExistenceVerification(article, brand);
}

/**
 * Свежий опрос поставщиков для клиентской карточки. В отличие от SEO-снимка
 * результат здесь нельзя отдавать из Data Cache: остаток, срок и закупочная
 * цена могут измениться у поставщика между соседними открытиями карточки.
 */
export async function fetchFreshProductSupplierSeed(
  article: string,
  brand: string
): Promise<ProductSupplierSeed> {
  const [mainItems, shateArticleId] = await Promise.all([
    searchAllSuppliers(
      adapters,
      { article, preferredBrand: brand, withCrosses: true },
      9000
    ).catch(() => [] as SupplierItem[]),
    (shateMAdapter as ShateMAdapter)
      .findArticleId(article, brand)
      .catch(() => null),
  ]);

  const pricing = (base: number, ctx: { brand?: string }) =>
    applyPricingSync(base, ctx);

  return {
    mainGroups: mergeFamilyGroups(groupOffers(mainItems, pricing)),
    shateArticleId,
  };
}

const loadProductSupplierSeed = unstable_cache(
  fetchFreshProductSupplierSeed,
  ["product-supplier-seed-v1"],
  { revalidate: 120 }
);

export async function getProductSupplierSeed(
  article: string,
  brand: string
): Promise<ProductSupplierSeed> {
  return loadProductSupplierSeed(article, brand);
}

/** Выбирает точный товар, не подменяя его дешёвым аналогом того же бренда. */
export function pickMainProductGroup(
  groups: SupplierGroup[],
  article: string,
  brand: string
): SupplierGroup | null {
  const wantedArticle = normalizeArticle(article);
  const wantedBrandKey = brand ? brandKey(canonicalBrand(brand)) : "";
  const sameArticle = groups.filter((group) => group.article === wantedArticle);

  return (
    (wantedBrandKey
      ? (sameArticle.find(
          (group) => brandKey(group.brand) === wantedBrandKey
        ) ?? sameArticle.find((group) => sameBrandFamily(group.brand, brand)))
      : sameArticle[0]) ?? null
  );
}
