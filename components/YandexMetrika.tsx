"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { getCookieConsent } from "@/components/cookie-banner";

/**
 * Яндекс.Метрика (счётчик 110334546) с уважением к cookie-согласию:
 *  • грузится ТОЛЬКО когда посетитель разрешил аналитические cookie
 *    (баннер → localStorage → getCookieConsent), и включается сразу после
 *    «Принять все» без перезагрузки (событие cookie-consent-changed);
 *  • SPA-хиты: Next не перезагружает страницу при переходах, поэтому на каждую
 *    смену pathname/query шлём ym('hit') — иначе Метрика видела бы только
 *    первый просмотр;
 *  • в dev не считаем (localhost-трафик не попадает в статистику). Для локальной
 *    отладки: NEXT_PUBLIC_YM_DEBUG=1 npm run dev.
 */

const YM_ID = 110334546;

const ENABLED =
  process.env.NODE_ENV === "production" ||
  process.env.NEXT_PUBLIC_YM_DEBUG === "1";

type YmFn = ((id: number, method: string, ...args: unknown[]) => void) & {
  a?: unknown[];
  l?: number;
};

declare global {
  interface Window {
    ym?: YmFn;
  }
}

/** Каноничный сниппет tag.js (адаптация официального кода Метрики). */
function loadMetrika() {
  const w = window;
  if (!w.ym) {
    const stub: YmFn = (...args: unknown[]) => {
      (stub.a = stub.a || []).push(args);
    };
    stub.l = Date.now();
    w.ym = stub;
  }
  if (
    !document.querySelector(
      'script[src^="https://mc.yandex.ru/metrika/tag.js"]'
    )
  ) {
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://mc.yandex.ru/metrika/tag.js?id=${YM_ID}`;
    document.head.appendChild(s);
    w.ym(YM_ID, "init", {
      ssr: true,
      webvisor: true,
      clickmap: true,
      ecommerce: "dataLayer",
      accurateTrackBounce: true,
      trackLinks: true,
    });
  }
}

/** SPA-хиты на смену маршрута. useSearchParams требует Suspense-обёртку. */
function MetrikaHits({ active }: { active: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const first = useRef(true);

  useEffect(() => {
    if (!active || !window.ym) return;
    // Первый просмотр отправляет сам init — наш первый эффект-запуск пропускаем,
    // иначе будет дубль хита.
    if (first.current) {
      first.current = false;
      return;
    }
    const qs = searchParams?.toString();
    window.ym(YM_ID, "hit", pathname + (qs ? `?${qs}` : ""));
  }, [active, pathname, searchParams]);

  return null;
}

export default function YandexMetrika() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!ENABLED) return;
    const sync = () => {
      const consent = getCookieConsent();
      if (consent?.analytics) {
        loadMetrika();
        setActive(true);
      } else {
        // Отзыв согласия: новые SPA-хиты не шлём; уже загруженный tag.js
        // выгрузить нельзя — полностью он исчезнет со следующей загрузки страницы.
        setActive(false);
      }
    };
    sync();
    window.addEventListener("cookie-consent-changed", sync);
    return () => window.removeEventListener("cookie-consent-changed", sync);
  }, []);

  if (!ENABLED) return null;
  return (
    <Suspense fallback={null}>
      <MetrikaHits active={active} />
    </Suspense>
  );
}
