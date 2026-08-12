"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";

/**
 * Удаление (скрытие) заказа из личного кабинета. Просит подтверждение, затем
 * DELETE /api/orders/:id. afterDelete="redirect" — уводит в кабинет (со страницы
 * заказа), "refresh" — обновляет список (в самом кабинете).
 */
export function DeleteOrderButton({
  orderId,
  afterDelete = "refresh",
}: {
  orderId: number;
  afterDelete?: "redirect" | "refresh";
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Не удалось удалить заказ");
      if (afterDelete === "redirect") router.push("/dashboard");
      else router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
      setLoading(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-red-400 underline-offset-2 hover:underline transition-colors"
      >
        <Trash2 className="h-4 w-4" />
        Удалить
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-neutral-300">Убрать заказ из кабинета?</span>
      <Button
        variant="destructive"
        size="sm"
        onClick={remove}
        disabled={loading}
        className="gap-2"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Да
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(false)}
        disabled={loading}
      >
        Нет
      </Button>
      {error && <span className="text-red-400 text-sm">{error}</span>}
    </div>
  );
}
