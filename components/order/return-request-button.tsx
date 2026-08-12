"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw, ShieldCheck, Check } from "lucide-react";

/**
 * Одна кнопка «Возврат / гарантия» на странице заказа. По клику клиент выбирает
 * тип (возврат или гарантия) и может оставить комментарий — заявка уходит в
 * магазин письмом с разной темой. Магазин связывается и решает вопрос.
 */
export function ReturnRequestButton({ orderId }: { orderId: number }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"return" | "warranty" | null>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!type) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Не удалось отправить заявку");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl bg-green-500/10 border border-green-500/20 p-3.5 text-sm text-neutral-300">
        <Check className="h-4 w-4 text-green-400 shrink-0" />
        Заявка принята — мы свяжемся с вами для решения вопроса.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-orange-400 underline-offset-2 hover:underline transition-colors"
      >
        <RotateCcw className="h-4 w-4" />
        Возврат / гарантия
      </button>
    );
  }

  return (
    <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-4 space-y-3">
      <p className="text-sm text-neutral-300">Что случилось с заказом?</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={type === "return" ? "default" : "outline"}
          size="sm"
          className="gap-2"
          onClick={() => setType("return")}
        >
          <RotateCcw className="h-4 w-4" />
          Возврат
        </Button>
        <Button
          type="button"
          variant={type === "warranty" ? "default" : "outline"}
          size="sm"
          className="gap-2"
          onClick={() => setType("warranty")}
        >
          <ShieldCheck className="h-4 w-4" />
          Гарантия
        </Button>
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="Кратко опишите проблему (необязательно)"
        className="w-full rounded-lg bg-neutral-950 border border-neutral-800 p-3 text-sm text-white placeholder:text-neutral-600 focus:border-orange-500/50 focus:outline-none resize-none"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          className="gap-2"
          disabled={!type || loading}
          onClick={submit}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Отправить заявку
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={() => setOpen(false)}
        >
          Отмена
        </Button>
      </div>
    </div>
  );
}
