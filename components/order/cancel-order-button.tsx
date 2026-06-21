"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

/**
 * Кнопка отмены неоплаченного заказа покупателем. Сначала просит подтверждение
 * (inline), затем дёргает /api/orders/:id/cancel и обновляет страницу.
 */
export function CancelOrderButton({ orderId }: { orderId: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Не удалось отменить заказ");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка отмены");
      setLoading(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm text-neutral-400 hover:text-red-400 underline-offset-2 hover:underline transition-colors"
      >
        Отменить заказ
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm text-neutral-300">Точно отменить заказ?</p>
      <div className="flex gap-2">
        <Button
          variant="destructive"
          size="sm"
          onClick={cancel}
          disabled={loading}
          className="gap-2"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Да, отменить
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(false)}
          disabled={loading}
        >
          Нет
        </Button>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}
