import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { productOfferSnapshots } from "@/lib/db/schema";
import { brandKey, canonicalBrand } from "@/lib/brands/canonical.mjs";
import {
  limitSupplierGroupOffers,
  normalizeArticle,
  type SupplierGroup,
} from "@/lib/suppliers/adapter";

export const PRODUCT_OFFER_SNAPSHOT_LIMIT = 20;

function identity(article: string, brand: string) {
  return {
    articleNorm: normalizeArticle(article),
    brandKey: brandKey(canonicalBrand(brand)),
  };
}

function isSupplierGroup(value: unknown): value is SupplierGroup {
  if (!value || typeof value !== "object") return false;
  const group = value as Partial<SupplierGroup>;
  return (
    typeof group.article === "string" &&
    typeof group.brand === "string" &&
    typeof group.name === "string" &&
    Array.isArray(group.offers) &&
    group.offers.length > 0 &&
    group.offers.every(
      (offer) =>
        offer &&
        typeof offer === "object" &&
        typeof offer.supplier === "string" &&
        typeof offer.supplierCode === "string" &&
        Number.isFinite(offer.ourPrice) &&
        Number.isFinite(offer.stock)
    )
  );
}

/** Читает постоянный снимок предложений для исходного серверного HTML. */
export async function getProductOfferSnapshot(
  article: string,
  brand: string
): Promise<SupplierGroup | null> {
  if (!article || !brand) return null;
  const key = identity(article, brand);
  const [row] = await db
    .select({ groupData: productOfferSnapshots.groupData })
    .from(productOfferSnapshots)
    .where(
      and(
        eq(productOfferSnapshots.articleNorm, key.articleNorm),
        eq(productOfferSnapshots.brandKey, key.brandKey)
      )
    )
    .limit(1);

  return isSupplierGroup(row?.groupData) ? row.groupData : null;
}

/**
 * Обновляет снимок только непустой успешной группой. Пустой/ошибочный ответ
 * поставщиков никогда не затирает последний рабочий снимок.
 */
export async function saveProductOfferSnapshot(
  article: string,
  brand: string,
  group: SupplierGroup
): Promise<void> {
  if (!article || !brand || !group.offers.length) return;

  const key = identity(article, brand);
  const limited = limitSupplierGroupOffers(group, PRODUCT_OFFER_SNAPSHOT_LIMIT);
  const current = await getProductOfferSnapshot(article, brand);

  // Общий поиск может вернуть частичный набор, если один из семи поставщиков
  // ушёл в таймаут. Такой ответ годится пользователю как свежий, но не должен
  // затирать более полный серверный снимок для поискового робота.
  if (current && limited.offers.length < current.offers.length) return;

  await db
    .insert(productOfferSnapshots)
    .values({
      articleNorm: key.articleNorm,
      brandKey: key.brandKey,
      article: limited.article,
      brand: limited.brand,
      groupData: limited as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        productOfferSnapshots.articleNorm,
        productOfferSnapshots.brandKey,
      ],
      set: {
        article: limited.article,
        brand: limited.brand,
        groupData: limited as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      },
    });
}
