import "server-only";
import {
  groupOffers,
  mergeFamilyGroups,
  normalizeArticle,
  searchAllSuppliers,
  type SupplierGroup,
} from "@/lib/suppliers/adapter";
import { brandKey, canonicalBrand } from "@/lib/brands/canonical.mjs";
import { sameBrandFamily } from "@/lib/brands/families.mjs";
import { applyPricingSync } from "@/lib/pricing";
import bergAdapter from "@/lib/suppliers/berg";
import rosskoAdapter from "@/lib/suppliers/rossko";
import shateMAdapter from "@/lib/suppliers/shate-m";
import forumAutoAdapter from "@/lib/suppliers/forum-auto";
import armtekAdapter from "@/lib/suppliers/armtek";
import autotradeAdapter from "@/lib/suppliers/autotrade";
import partKomAdapter from "@/lib/suppliers/partkom";

/**
 * Актуальная группа точного товара для SEO-шелла приоритетных карточек.
 * Запрашиваем только сам артикул, без кроссов и характеристик: title, H1 и
 * минимальная цена должны совпадать с живой карточкой, но метаданные не должны
 * запускать тяжёлую загрузку аналогов.
 */
export async function findLiveProductGroup(
  article: string,
  brand: string
): Promise<SupplierGroup | null> {
  const items = await searchAllSuppliers(
    [
      bergAdapter,
      rosskoAdapter,
      shateMAdapter,
      forumAutoAdapter,
      armtekAdapter,
      autotradeAdapter,
      partKomAdapter,
    ],
    { article, withCrosses: false },
    6000
  );

  const groups = mergeFamilyGroups(
    groupOffers(items, (basePrice, ctx) => applyPricingSync(basePrice, ctx))
  );
  const wantedArticle = normalizeArticle(article);
  const wantedBrandKey = brand ? brandKey(canonicalBrand(brand)) : "";
  const sameArticle = groups.filter((group) => group.article === wantedArticle);

  const group =
    (wantedBrandKey
      ? sameArticle.find((candidate) => brandKey(candidate.brand) === wantedBrandKey) ??
        sameArticle.find((candidate) => sameBrandFamily(candidate.brand, brand))
      : sameArticle[0]) ?? null;

  if (!group) return null;

  return {
    ...group,
    article: wantedArticle,
    brand: canonicalBrand(brand || group.brand),
  };
}
