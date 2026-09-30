import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { cartItems, products } from "@/lib/db/schema";
import {
  compareOffers,
  type SupplierGroup,
  type SupplierOffer,
} from "@/lib/suppliers/adapter";
import {
  fetchFreshProductSupplierSeed,
  pickMainProductGroup,
} from "@/lib/product-supplier-seed";
import {
  getProductOfferSnapshotState,
  saveProductOfferSnapshot,
} from "@/lib/product-offer-snapshot";
import { buildSupplierAllocation } from "@/lib/cart/fulfillment";
import { getEffectiveDeliveryDays } from "@/lib/utils";
import { getProductSeoSnapshot } from "@/lib/seo/product-snapshot";
import {
  getSafeProductName,
  isUsableProductName,
} from "@/lib/suppliers/mojibake";

export const CART_VERIFICATION_TTL_MS = 60 * 60 * 1000;

export function isCartItemVerificationFresh(
  verifiedAt: Date | null | undefined,
  now = new Date()
): boolean {
  if (!verifiedAt) return false;
  const age = now.getTime() - verifiedAt.getTime();
  return age >= 0 && age < CART_VERIFICATION_TTL_MS;
}

export function getCartProductDisplayName(
  article: string,
  brand: string | null | undefined,
  ...candidates: Array<string | null | undefined>
): string {
  const safeBrand = brand || undefined;
  const seoName = getProductSeoSnapshot(article, safeBrand)?.name;
  const resolved = [seoName, ...candidates].find((name) =>
    isUsableProductName(name, article, safeBrand)
  );
  return getSafeProductName(resolved, article, safeBrand);
}

export async function isCartItemVerificationNeeded(item: {
  verifiedAt: Date | null | undefined;
  selectionMode: string;
  sourceOfferId: string | null;
  supplierCode: string | null;
  offerSupplier: string | null;
  product: { article: string; brand: string | null };
}): Promise<boolean> {
  if (!isCartItemVerificationFresh(item.verifiedAt)) return true;
  const snapshot = await getProductOfferSnapshotState(
    item.product.article,
    item.product.brand || ""
  ).catch(() => null);
  if (
    !snapshot ||
    !item.verifiedAt ||
    snapshot.updatedAt.getTime() <= item.verifiedAt.getTime()
  ) {
    return false;
  }
  return (
    item.selectionMode !== "fixed" ||
    Boolean(findStableOffer(item, snapshot.group))
  );
}

export interface RequestedCartOffer {
  article: string;
  brand: string;
  ourPrice: number;
  stock: number;
  deliveryDays: number | null;
  supplierCode?: string;
  supplierIdentity?: string | null;
}

export interface ResolvedCartOffer {
  group: SupplierGroup;
  offer: SupplierOffer;
  verifiedAt: Date;
}

function sameNumber(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

function findRequestedOffer(
  group: SupplierGroup,
  requested: RequestedCartOffer
): SupplierOffer | null {
  return (
    group.offers.find(
      (offer) =>
        (!requested.supplierCode ||
          offer.supplierCode.toLowerCase() ===
            requested.supplierCode.toLowerCase()) &&
        (!requested.supplierIdentity ||
          offer.supplier === requested.supplierIdentity) &&
        sameNumber(offer.ourPrice, requested.ourPrice) &&
        offer.stock === requested.stock &&
        offer.deliveryDays === requested.deliveryDays
    ) ?? null
  );
}

async function loadFreshGroup(
  article: string,
  brand: string
): Promise<SupplierGroup | null> {
  const { mainGroups } = await fetchFreshProductSupplierSeed(article, brand);
  const group = pickMainProductGroup(mainGroups, article, brand);
  if (group) {
    await saveProductOfferSnapshot(article, brand || group.brand, group).catch(
      (error) => console.error("Cart offer snapshot write error:", error)
    );
  }
  return group;
}

/**
 * Проверяет выбранный в браузере оффер по серверному источнику. Свежий снимок
 * можно использовать в пределах того же согласованного часа; иначе выполняется
 * один живой опрос поставщиков. Переданные браузером цена и остаток служат
 * только для поиска строки и никогда не записываются без серверного совпадения.
 */
export async function resolveRequestedCartOffer(
  requested: RequestedCartOffer
): Promise<ResolvedCartOffer | null> {
  const now = new Date();
  const snapshot = await getProductOfferSnapshotState(
    requested.article,
    requested.brand
  ).catch(() => null);

  if (
    snapshot &&
    now.getTime() - snapshot.updatedAt.getTime() < CART_VERIFICATION_TTL_MS
  ) {
    const offer = findRequestedOffer(snapshot.group, requested);
    if (offer) {
      return { group: snapshot.group, offer, verifiedAt: snapshot.updatedAt };
    }
  }

  const group = await loadFreshGroup(requested.article, requested.brand);
  if (!group) return null;
  const offer = findRequestedOffer(group, requested);
  return offer ? { group, offer, verifiedAt: new Date() } : null;
}

function findStableOffer(
  item: {
    sourceOfferId: string | null;
    supplierCode: string | null;
    offerSupplier: string | null;
  },
  group: SupplierGroup
): SupplierOffer | null {
  if (item.sourceOfferId) {
    const exact = group.offers.find(
      (offer) =>
        offer.sourceOfferId === item.sourceOfferId &&
        (!item.supplierCode || offer.supplierCode === item.supplierCode)
    );
    if (exact) return exact;
  }

  if (item.supplierCode && item.offerSupplier) {
    const sameWarehouse = group.offers
      .filter(
        (offer) =>
          offer.supplierCode === item.supplierCode &&
          offer.supplier === item.offerSupplier
      )
      .sort(compareOffers)[0];
    if (sameWarehouse) return sameWarehouse;
  }

  return null;
}

function deliveryWorsened(
  previous: number | null,
  current: number | null
): boolean {
  const previousEffective = getEffectiveDeliveryDays(previous);
  const currentEffective = getEffectiveDeliveryDays(current);
  if (previousEffective == null) return false;
  if (currentEffective == null) return true;
  return currentEffective > previousEffective;
}

export interface CartRefreshResult {
  checked: number;
  unavailable: number;
  insufficientStock: number;
  failed: number;
}

/**
 * Сверяет просроченные строки и строки, для которых карточка уже получила более
 * свежий снимок. Основная позиция следует за текущим главным оффером, а явно
 * выбранная позиция остаётся на своём складе.
 */
export async function refreshCartOffers(
  cartId: number,
  onlyItemIds?: number[]
): Promise<CartRefreshResult> {
  const idFilter = onlyItemIds?.length
    ? inArray(cartItems.id, onlyItemIds)
    : undefined;
  const rows = await db.query.cartItems.findMany({
    where: idFilter
      ? and(eq(cartItems.cartId, cartId), idFilter)
      : eq(cartItems.cartId, cartId),
    with: { product: true },
  });

  const grouped = new Map<string, typeof rows>();
  for (const item of rows) {
    const key = `${item.product.article}\u0000${item.product.brand || ""}`;
    const bucket = grouped.get(key);
    if (bucket) bucket.push(item);
    else grouped.set(key, [item]);
  }

  const result: CartRefreshResult = {
    checked: 0,
    unavailable: 0,
    insufficientStock: 0,
    failed: 0,
  };
  const groups = Array.from(grouped.values());
  let cursor = 0;

  async function worker() {
    while (cursor < groups.length) {
      const items = groups[cursor++];
      const first = items[0];
      const article = first.product.article;
      const brand = first.product.brand || "";
      const snapshot = await getProductOfferSnapshotState(article, brand).catch(
        () => null
      );
      const itemsToRefresh = items.filter(
        (item) =>
          !isCartItemVerificationFresh(item.verifiedAt) ||
          Boolean(
            snapshot &&
              item.verifiedAt &&
              snapshot.updatedAt.getTime() > item.verifiedAt.getTime() &&
              (item.selectionMode !== "fixed" ||
                findStableOffer(item, snapshot.group))
          )
      );
      if (itemsToRefresh.length === 0) continue;

      const requiresLive = itemsToRefresh.some(
        (item) => !isCartItemVerificationFresh(item.verifiedAt)
      );
      let group: SupplierGroup | null = snapshot?.group ?? null;
      let verifiedAt = snapshot?.updatedAt ?? new Date();
      try {
        if (requiresLive) {
          group = await loadFreshGroup(article, brand);
          // Ставим время после живого опроса и записи снимка, чтобы только что
          // проверенная строка не считалась старее созданного ею снимка.
          verifiedAt = new Date();
        }
      } catch (error) {
        console.error("Cart offer refresh error:", error);
        result.failed += itemsToRefresh.length;
        continue;
      }

      if (!group?.offers.length) {
        for (const item of itemsToRefresh) {
          await db
            .update(cartItems)
            .set({
              verifiedAt,
              verificationStatus: "unavailable",
              availableStock: 0,
              conditionChange: null,
            })
            .where(eq(cartItems.id, item.id));
          result.checked += 1;
          result.unavailable += 1;
        }
        continue;
      }

      const displayName = getCartProductDisplayName(
        article,
        brand,
        group.name,
        first.product.name
      );
      if (
        displayName !== first.product.name &&
        isUsableProductName(displayName, article, brand)
      ) {
        await db
          .update(products)
          .set({ name: displayName, updatedAt: new Date() })
          .where(eq(products.id, first.productId));
      }

      const bestOffer = [...group.offers].sort(compareOffers)[0];
      for (const item of itemsToRefresh) {
        const fixedOffer =
          item.selectionMode === "fixed" ? findStableOffer(item, group) : null;
        // Новый снимок карточки содержит только витринную двадцатку. Если явно
        // выбранного оффера в ней нет, это ещё не доказывает недоступность -
        // оставляем свежую строку до полноценной часовой проверки поставщиков.
        if (item.selectionMode === "fixed" && !fixedOffer && !requiresLive) {
          continue;
        }
        if (item.selectionMode === "fixed" && !fixedOffer) {
          await db
            .update(cartItems)
            .set({
              verifiedAt,
              verificationStatus: "unavailable",
              availableStock: 0,
              conditionChange: null,
            })
            .where(eq(cartItems.id, item.id));
          result.checked += 1;
          result.unavailable += 1;
          continue;
        }

        const offer = fixedOffer ?? bestOffer;
        const previousPrice = Number(
          item.price ?? item.product.ourPrice ?? offer.ourPrice
        );
        const previousDeliveryDays = item.deliveryDays ?? null;
        const priceIncreased = offer.ourPrice > previousPrice + 0.005;
        const becameSlower = deliveryWorsened(
          previousDeliveryDays,
          offer.deliveryDays
        );
        const enoughStock = item.qty <= offer.stock;

        await db
          .update(cartItems)
          .set({
            price: offer.ourPrice.toFixed(2),
            deliveryDays: offer.deliveryDays,
            supplier: buildSupplierAllocation(offer, item.qty),
            supplierCode: offer.supplierCode,
            offerSupplier: offer.supplier,
            sourceOfferId: offer.sourceOfferId ?? null,
            availableStock: offer.stock,
            verifiedAt,
            verificationStatus: enoughStock
              ? "verified"
              : "insufficient_stock",
            conditionChange:
              priceIncreased || becameSlower
                ? {
                    previousPrice,
                    previousDeliveryDays,
                    priceIncreased,
                    deliveryWorsened: becameSlower,
                  }
                : null,
          })
          .where(eq(cartItems.id, item.id));

        result.checked += 1;
        if (!enoughStock) result.insufficientStock += 1;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(3, groups.length) }, () => worker())
  );
  return result;
}
