"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import {
  orderStatusMeta,
  ADMIN_SETTABLE_STATUSES,
} from "@/lib/order-status";
import { Package, User, Phone, Mail, Loader2, MessageCircle } from "lucide-react";

interface AdminOrderItem {
  id: number;
  name: string;
  article: string;
  brand: string | null;
  qty: number;
  price: string;
}

interface AdminOrder {
  id: number;
  status: string;
  total: string;
  paymentId: string | null;
  createdAt: string;
  customer: {
    email: string | null;
    fullName: string | null;
    phone: string | null;
    contactEmail: string | null;
    telegram: string | null;
    whatsapp: string | null;
    vk: string | null;
    maxMessenger: string | null;
  };
  items: AdminOrderItem[];
}

export default function AdminOrdersList({ orders }: { orders: AdminOrder[] }) {
  const [list, setList] = useState(orders);
  const [savingId, setSavingId] = useState<number | null>(null);

  async function changeStatus(orderId: number, status: string) {
    setSavingId(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Не удалось сохранить статус");
      }
      setList((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o))
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSavingId(null);
    }
  }

  if (list.length === 0) {
    return (
      <div className="text-center py-16 text-neutral-500">
        <Package className="h-10 w-10 mx-auto mb-3 text-neutral-700" />
        Заказов пока нет
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {list.map((order) => {
        const meta = orderStatusMeta(order.status);
        return (
          <Card key={order.id} className="border-neutral-800 bg-neutral-900">
            <CardContent className="p-5 space-y-4">
              {/* Шапка */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-white font-bold text-lg">
                    Заказ №{order.id}
                  </p>
                  <p className="text-neutral-500 text-sm">
                    {new Date(order.createdAt).toLocaleString("ru-RU")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                  <span className="text-orange-500 font-bold text-lg">
                    {formatPrice(order.total)}
                  </span>
                </div>
              </div>

              {/* Покупатель */}
              <div className="bg-neutral-800/40 rounded-lg p-3 space-y-1.5">
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-neutral-300">
                  <span className="inline-flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-neutral-500" />
                    {order.customer.fullName || "Имя не указано"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-neutral-500" />
                    {order.customer.phone || "—"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-neutral-500" />
                    {order.customer.contactEmail || order.customer.email || "—"}
                  </span>
                </div>
                {(order.customer.telegram ||
                  order.customer.whatsapp ||
                  order.customer.maxMessenger ||
                  order.customer.vk) && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-400 pt-1 border-t border-neutral-700/50">
                    <span className="inline-flex items-center gap-1.5">
                      <MessageCircle className="h-3.5 w-3.5 text-neutral-500" />
                      Связь:
                    </span>
                    {order.customer.telegram && <span>Telegram: {order.customer.telegram}</span>}
                    {order.customer.whatsapp && <span>WhatsApp: {order.customer.whatsapp}</span>}
                    {order.customer.maxMessenger && <span>MAX: {order.customer.maxMessenger}</span>}
                    {order.customer.vk && <span>ВК: {order.customer.vk}</span>}
                  </div>
                )}
              </div>

              {/* Позиции */}
              <div className="divide-y divide-neutral-800 border border-neutral-800 rounded-lg">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-4 p-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="text-white truncate">{item.name}</p>
                      <p className="text-neutral-500 font-mono text-xs">
                        {item.article}
                        {item.brand ? ` · ${item.brand}` : ""}
                      </p>
                    </div>
                    <div className="text-neutral-300 whitespace-nowrap">
                      {item.qty} × {formatPrice(item.price)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Управление статусом */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-neutral-400">Статус:</span>
                <select
                  value={
                    ADMIN_SETTABLE_STATUSES.includes(
                      order.status as (typeof ADMIN_SETTABLE_STATUSES)[number]
                    )
                      ? order.status
                      : ""
                  }
                  onChange={(e) => changeStatus(order.id, e.target.value)}
                  disabled={savingId === order.id}
                  className="bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500 disabled:opacity-50"
                >
                  {/* Текущий статус, если он не из настраиваемых (например, awaiting_payment) */}
                  {!ADMIN_SETTABLE_STATUSES.includes(
                    order.status as (typeof ADMIN_SETTABLE_STATUSES)[number]
                  ) && (
                    <option value="" disabled>
                      {orderStatusMeta(order.status).label}
                    </option>
                  )}
                  {ADMIN_SETTABLE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {orderStatusMeta(s).label}
                    </option>
                  ))}
                </select>
                {savingId === order.id && (
                  <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                )}
                {order.paymentId && (
                  <span className="text-xs text-neutral-600 ml-auto font-mono">
                    {order.paymentId}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
