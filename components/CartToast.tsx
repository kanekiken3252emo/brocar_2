"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

interface ToastState {
  id: number;
  kind: "success" | "error";
  title: string;
  subtitle?: string;
}

export default function CartToast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    const addedHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        article: string;
        brand: string;
        name: string;
        qty: number;
      };
      setToast({
        id: Date.now(),
        kind: "success",
        title: "Добавлено в корзину",
        subtitle: `${detail.brand || ""} ${detail.article}`.trim(),
      });
    };

    const errorHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { message: string };
      setToast({
        id: Date.now(),
        kind: "error",
        title: "Ошибка",
        subtitle: detail.message,
      });
    };

    window.addEventListener("cart:added", addedHandler);
    window.addEventListener("cart:error", errorHandler);
    return () => {
      window.removeEventListener("cart:added", addedHandler);
      window.removeEventListener("cart:error", errorHandler);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  const isSuccess = toast.kind === "success";
  return (
    <div
      key={toast.id}
      className={`fixed bottom-6 right-6 z-50 min-w-[280px] max-w-sm bg-neutral-900 border px-5 py-4 rounded-xl shadow-2xl flex items-start gap-3 ${
        isSuccess ? "border-orange-500/40" : "border-red-500/40"
      }`}
      style={{ animation: "slide-in 0.2s ease-out" }}
    >
      {isSuccess ? (
        <CheckCircle2 className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
      ) : (
        <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white">{toast.title}</div>
        {toast.subtitle && (
          <div className="text-xs text-neutral-400 mt-0.5 truncate">
            {toast.subtitle}
          </div>
        )}
      </div>
      <style jsx>{`
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
