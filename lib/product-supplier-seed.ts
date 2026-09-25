import "server-only";
import { unstable_cache } from "next/cache";
import {
  groupOffers,
  mergeFamilyGroups,
  normalizeArticle,
  searchAllSuppliers,
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

/**
 * Общий двухминутный снимок живого поиска. Серверный HTML пятой SEO-волны и
 * последующий клиентский API используют одни данные, не опрашивая семь
 * поставщиков дважды при одном открытии карточки.
 */
const loadProductSupplierSeed = unstable_cache(
  async (article: string, brand: string): Promise<ProductSupplierSeed> => {
    const adapters = [
      bergAdapter,
      rosskoAdapter,
      shateMAdapter,
      forumAutoAdapter,
      armtekAdapter,
      autotradeAdapter,
      partKomAdapter,
    ];

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
  },
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
