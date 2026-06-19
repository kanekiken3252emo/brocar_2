"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

const FLASH_KEY = "brocar:flash";

/**
 * Показывает одноразовое уведомление, переданное через sessionStorage
 * (например, «Вы успешно зарегистрированы!» после редиректа на главную).
 * Переживает полную навигацию между страницами в рамках вкладки.
 */
export default function FlashToast() {
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let m: string | null = null;
    try {
      m = sessionStorage.getItem(FLASH_KEY);
      if (m) sessionStorage.removeItem(FLASH_KEY);
    } catch {}
    if (!m) return;
    setMsg(m);
    const t = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(t);
  }, []);

  if (!msg) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] max-w-[92vw] px-2">
      <div className="flex items-center gap-3 bg-neutral-900 border border-green-500/40 text-white px-5 py-3.5 rounded-xl shadow-2xl animate-in fade-in slide-in-from-bottom-2">
        <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
        <span className="text-sm font-medium">{msg}</span>
      </div>
    </div>
  );
}
