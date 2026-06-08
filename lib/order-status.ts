import type { BadgeProps } from "@/components/ui/badge";

type Variant = NonNullable<BadgeProps["variant"]>;

/**
 * Статусы заказа: метка на русском + цвет бейджа.
 * status хранится строкой в orders.status.
 *
 * Системные (ставятся автоматически): pending, awaiting_payment, accepted, canceled.
 * Рабочие (ставит админ вручную) — см. ADMIN_SETTABLE_STATUSES ниже.
 */
export const ORDER_STATUS_META: Record<
  string,
  { label: string; variant: Variant }
> = {
  // системные / до оплаты
  pending: { label: "Создан", variant: "secondary" },
  awaiting_payment: { label: "Ждёт оплаты", variant: "warning" },

  // рабочие статусы
  accepted: { label: "Принят", variant: "success" },
  awaiting_confirmation: { label: "Ждёт подтверждения", variant: "warning" },
  processing: { label: "В работе", variant: "default" },
  in_transit_supplier: { label: "В пути со стороннего склада", variant: "default" },
  in_transit: { label: "В пути", variant: "default" },
  ready: { label: "Готов к получению", variant: "success" },
  partially_ready: { label: "Частично готов к получению", variant: "warning" },
  issued: { label: "Выдан", variant: "secondary" },
  canceled: { label: "Отменён", variant: "destructive" },

  // легаси (старые заказы) — на всякий случай, чтобы корректно отображались
  paid: { label: "Оплачен", variant: "success" },
  shipped: { label: "Отправлен", variant: "default" },
  completed: { label: "Выполнен", variant: "success" },
};

export function orderStatusMeta(status: string): { label: string; variant: Variant } {
  return ORDER_STATUS_META[status] ?? { label: status, variant: "secondary" };
}

/** Статус, который заказ получает автоматически после успешной оплаты. */
export const STATUS_AFTER_PAYMENT = "accepted";

/** Статусы, которые владелец может выставлять вручную в админке (в нужном порядке). */
export const ADMIN_SETTABLE_STATUSES = [
  "accepted",
  "awaiting_confirmation",
  "processing",
  "in_transit_supplier",
  "in_transit",
  "ready",
  "partially_ready",
  "issued",
  "canceled",
] as const;

/**
 * Архивные статусы — заказ закрыт и убирается из активного списка в админке.
 * «Выдан» = заказ отдали клиенту.
 */
export const ARCHIVED_STATUSES: readonly string[] = ["issued"];

/** Заказ в архиве (выдан) — не мешает в активном списке. */
export function isArchived(status: string): boolean {
  return ARCHIVED_STATUSES.includes(status);
}

/** «В обработке» — для статистики в личном кабинете. */
export function isInProgress(status: string): boolean {
  return [
    "accepted",
    "awaiting_confirmation",
    "processing",
    "partially_ready",
    "paid",
  ].includes(status);
}

/** «Доставляется / в пути» — для статистики в личном кабинете. */
export function isShipping(status: string): boolean {
  return ["in_transit", "in_transit_supplier", "shipped"].includes(status);
}
