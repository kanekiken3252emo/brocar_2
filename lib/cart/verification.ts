import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { cartItems } from "@/lib/db/schema";
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

export const CART_VERIFICATION_TTL_MS = 60 * 60 * 1000;

export function isCartItemVerificationFresh(
  verifiedAt: Date | null | undefined,
  now = new Date()
): boolean {
  if (!verifiedAt) return false;
  const age = now.getTime() - verifiedAt.getTime();
  return age >= 0 && age < CART_VERIFICATION_TTL_MS;
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
  return offer ? { group, offer, verifiedAt: now } : null;
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

/** Одна серверная сверка просроченных/легаси-позиций корзины. */
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

  const now = new Date();
  const stale = rows.filter(
    (item) => !isCartItemVerificationFresh(item.verifiedAt, now)
  );
  const grouped = new Map<string, typeof stale>();
  for (const item of stale) {
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
      let group: SupplierGroup | null;
      try {
        group = await loadFreshGroup(
          first.product.article,
          first.product.brand || ""
        );
      } catch (error) {
        console.error("Cart offer refresh error:", error);
        result.failed += items.length;
        continue;
      }

      if (!group?.offers.length) {
        for (const item of items) {
          await db
            .update(cartItems)
            .set({
              verifiedAt: now,
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

      const bestOffer = [...group.offers].sort(compareOffers)[0];
      for (const item of items) {
        // У новой строки сохраняем тот же склад. Легаси-строка (нет серверной
        // привязки) автоматически получает текущее лучшее предложение.
        const offer = findStableOffer(item, group) ?? bestOffer;
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
            verifiedAt: now,
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
