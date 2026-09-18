import type { SupplierOffer } from "@/lib/suppliers/adapter";

type RoutableOffer = Pick<SupplierOffer, "supplier" | "stock" | "fulfillment">;

/**
 * Формирует внутренний маршрут закупки для выбранного количества. Покупателю
 * строка не показывается, но попадает в корзину, заказ и письмо магазину.
 */
export function buildSupplierAllocation(
  offer: RoutableOffer,
  requestedQty: number
): string {
  const qty = Math.max(1, Math.min(Math.trunc(requestedQty), offer.stock));
  const parts = offer.fulfillment?.length
    ? offer.fulfillment.filter((part) => part.stock > 0)
    : [{ supplier: offer.supplier, stock: offer.stock }];

  let remaining = qty;
  const allocations: Array<{ supplier: string; qty: number }> = [];
  for (const part of parts) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, part.stock);
    if (take > 0) allocations.push({ supplier: part.supplier, qty: take });
    remaining -= take;
  }

  if (allocations.length <= 1)
    return allocations[0]?.supplier || offer.supplier;
  return allocations
    .map((allocation) => `${allocation.supplier}: ${allocation.qty} шт.`)
    .join("; ");
}
