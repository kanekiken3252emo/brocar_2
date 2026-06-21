"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2 } from "lucide-react";

/**
 * Кнопка «Оплатить»: создаёт платёж в ЮKassa для существующего заказа и
 * перенаправляет на форму оплаты. Используется в экране «ожидание оплаты».
 */
export function PayButton({
  orderId,
  label = "Оплатить заказ",
  className,
}: {
  orderId: number;
  label?: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!res.ok || !data?.confirmationUrl) {
        throw new Error(data?.error || "Не удалось создать платёж");
      }
      window.location.href = data.confirmationUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка оплаты");
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <Button onClick={pay} disabled={loading} size="lg" className="gap-2 w-full sm:w-auto">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="h-4 w-4" />
        )}
        {loading ? "Переходим к оплате…" : label}
      </Button>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  );
}
