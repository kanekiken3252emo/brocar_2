import type { BadgeProps } from "@/components/ui/badge";

type Variant = NonNullable<BadgeProps["variant"]>;

/**
 * Статусы заказа: метка на русском + цвет бейджа.
 * status хранится строкой в orders.status.
 */
export const ORDER_STATUS_META: Record<
  string,
  { label: string; variant: Variant }
> = {
  pending: { label: "Создан", variant: "secondary" },
  awaiting_payment: { label: "Ожидает оплаты", variant: "warning" },
  paid: { label: "Оплачен", variant: "success" },
  processing: { label: "Собираем", variant: "default" },
  shipped: { label: "Отправлен", variant: "default" },
  completed: { label: "Выполнен", variant: "success" },
  canceled: { label: "Отменён", variant: "destructive" },
};

export function orderStatusMeta(status: string): { label: string; variant: Variant } {
  return ORDER_STATUS_META[status] ?? { label: status, variant: "secondary" };
}

/** Статусы, которые владелец может выставлять вручную в админке. */
export const ADMIN_SETTABLE_STATUSES = [
  "paid",
  "processing",
  "shipped",
  "completed",
  "canceled",
] as const;

/** Считается ли заказ «в работе» (оплачен/собирается) — для статистики. */
export function isInProgress(status: string): boolean {
  return status === "paid" || status === "processing";
}
