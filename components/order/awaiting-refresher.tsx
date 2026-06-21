"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Пока заказ ждёт оплаты — тихо обновляем страницу через router.refresh(),
 * чтобы подхватить подтверждение от ЮKassa (его ставит вебхук или серверная
 * сверка на самой странице). Останавливаемся через maxChecks, чтобы не крутить
 * бесконечно, если человек просто ушёл, не оплатив.
 */
export function AwaitingRefresher({
  intervalMs = 5000,
  maxChecks = 24,
}: {
  intervalMs?: number;
  maxChecks?: number;
}) {
  const router = useRouter();
  const [active, setActive] = useState(true);

  useEffect(() => {
    let checks = 0;
    const timer = setInterval(() => {
      checks += 1;
      router.refresh();
      if (checks >= maxChecks) {
        clearInterval(timer);
        setActive(false);
      }
    }, intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs, maxChecks]);

  if (!active) return null;

  return (
    <p className="flex items-center gap-2 text-sm text-neutral-400">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      Проверяем оплату автоматически…
    </p>
  );
}
