"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { getCookieConsent } from "@/components/cookie-banner";
import {
  reachYandexMetrikaGoal,
  YM_COUNTER_ID,
  type YmFn,
} from "@/lib/analytics/yandex-metrika";

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

const ENABLED =
  process.env.NODE_ENV === "production" ||
  process.env.NEXT_PUBLIC_YM_DEBUG === "1";

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
    s.src = `https://mc.yandex.ru/metrika/tag.js?id=${YM_COUNTER_ID}`;
    document.head.appendChild(s);
    w.ym(YM_COUNTER_ID, "init", {
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
  const checkoutTracked = useRef(false);

  useEffect(() => {
    if (!active || !window.ym) return;

    // Цель означает фактический вход в оформление, а не клик по кнопке,
    // который мог закончиться ошибкой навигации. За один вход отправляем один раз.
    if (pathname === "/checkout" && !checkoutTracked.current) {
      reachYandexMetrikaGoal("checkout_started");
      checkoutTracked.current = true;
    } else if (pathname !== "/checkout") {
      checkoutTracked.current = false;
    }

    // Первый просмотр отправляет сам init — наш первый эффект-запуск пропускаем,
    // иначе будет дубль хита.
    if (first.current) {
      first.current = false;
      return;
    }
    const qs = searchParams?.toString();
    window.ym(
      YM_COUNTER_ID,
      "hit",
      pathname + (qs ? `?${qs}` : "")
    );
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

  useEffect(() => {
    if (!active) return;

    const onCartAdded = () => reachYandexMetrikaGoal("cart_item_added");
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;

      const href = anchor.href;
      if (href.startsWith("tel:")) {
        reachYandexMetrikaGoal("phone_clicked");
        return;
      }

      try {
        const host = new URL(href).hostname.toLowerCase();
        const messengerHosts = [
          "t.me",
          "telegram.me",
          "wa.me",
          "api.whatsapp.com",
          "web.whatsapp.com",
          "max.ru",
        ];
        if (
          messengerHosts.some(
            (messengerHost) =>
              host === messengerHost || host.endsWith(`.${messengerHost}`)
          )
        ) {
          reachYandexMetrikaGoal("messenger_clicked");
        }
      } catch {
        // Некорректная ссылка не должна мешать обычному клику пользователя.
      }
    };

    window.addEventListener("cart:added", onCartAdded);
    document.addEventListener("click", onDocumentClick, true);
    return () => {
      window.removeEventListener("cart:added", onCartAdded);
      document.removeEventListener("click", onDocumentClick, true);
    };
  }, [active]);

  if (!ENABLED) return null;
  return (
    <Suspense fallback={null}>
      <MetrikaHits active={active} />
    </Suspense>
  );
}
