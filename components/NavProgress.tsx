"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Тонкая полоска прогресса вверху на время перехода между страницами.
 *
 * Зачем: страницы каталога/карточки — серверные компоненты, и при клике Next
 * сначала МОЛЧА тянет RSC-пейлоад (фетч данных ~0.5-1.7с), всё это время старая
 * страница висит без реакции — пользователь думает «подвисло». Полоска мгновенно
 * реагирует на клик по внутренней ссылке и закрывается, когда новый URL отрисован.
 *
 * Без зависимостей. App Router не даёт router.events, поэтому: СТАРТ — по клику на
 * внутреннюю <a>/popstate; ФИНИШ — по смене pathname+searchParams.
 */
export default function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function start() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (trickle.current) clearInterval(trickle.current);
    setVisible(true);
    setWidth(8);
    // «Подползание» к 90% — создаёт ощущение прогресса, пока ждём сервер.
    trickle.current = setInterval(() => {
      setWidth((p) => (p < 90 ? p + (90 - p) * 0.15 : p));
    }, 250);
  }

  function done() {
    if (trickle.current) clearInterval(trickle.current);
    setWidth(100);
    hideTimer.current = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 250);
  }

  // Финиш: URL (pathname или query) изменился — новая страница отрисована.
  useEffect(() => {
    done();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  // Старт: клик по внутренней ссылке или навигация назад/вперёд.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      const target = e.target as HTMLElement | null;
      const a = target?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (
        !href ||
        a.getAttribute("target") === "_blank" ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      )
        return;
      try {
        const u = new URL(href, location.href);
        if (u.origin !== location.origin) return; // внешняя ссылка
        if (u.pathname + u.search === location.pathname + location.search)
          return; // та же страница
      } catch {
        return;
      }
      start();
    };
    const onPop = () => start();
    document.addEventListener("click", onClick);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("popstate", onPop);
      if (trickle.current) clearInterval(trickle.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (!visible) return null;
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${width}%`,
          background: "#ea580c",
          boxShadow: "0 0 8px #ea580c, 0 0 4px #ea580c",
          transition: "width 250ms ease-out",
        }}
      />
    </div>
  );
}
