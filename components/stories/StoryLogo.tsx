"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, Home } from "lucide-react";
import StoryViewer, { type Story } from "./StoryViewer";

const SEEN_KEY = "brocar:storiesSeen";

function loadSeen(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

/**
 * Один логотип BroCar. Если историй нет — обычная ссылка на главную. Если есть —
 * у логотипа появляется сегментное кольцо (как в Telegram), а клик открывает
 * компактное меню: «Истории» (со счётчиком новых) и «На главную».
 */
export default function StoryLogo() {
  const [stories, setStories] = useState<Story[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [seen, setSeen] = useState<number[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSeen(loadSeen());
    let cancelled = false;
    fetch("/api/stories")
      .then((r) => (r.ok ? r.json() : { stories: [] }))
      .then((d) => {
        if (!cancelled && Array.isArray(d.stories)) setStories(d.stories);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Закрытие меню по клику вне / Esc.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const hasStories = stories.length > 0;
  const unseenCount = stories.filter((s) => !seen.includes(s.id)).length;

  const markSeen = (id: number) => {
    setSeen((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const img = (
    <Image
      // Маленькая статичная версия + unoptimized: лого отдаётся напрямую как
      // файл (6 КБ webp), минуя /_next/image. Так бренд-логотип не зависит от
      // оптимизатора (sharp/AVIF/Accept) и не «икает» на отдельных устройствах
      // (баг «битый логотип в Safari/Яндексе на iOS»). webp поддерживают iOS 14+.
      src="/Logo_Brocar-sm.webp"
      alt="BroCar"
      width={256}
      height={256}
      className="w-full h-full object-contain brightness-125 md:brightness-100"
      priority
      unoptimized
    />
  );

  // Геометрия сегментного кольца (viewBox 100×100).
  const n = stories.length;
  const STROKE = 4;
  const R = 50 - STROKE / 2;
  const C = 2 * Math.PI * R;
  const GAP = n > 1 ? 7 : 0;
  const SEG = n > 0 ? C / n : C;
  const DASH = Math.max(SEG - GAP, 0.1);

  const logoVisual = (
    <div className="relative h-[4.25rem] w-[4.25rem] md:h-20 md:w-20 lg:h-[5.25rem] lg:w-[5.25rem]">
      <div className="absolute inset-0 bg-orange-500/50 md:bg-orange-500/25 rounded-full blur-md md:blur-xl scale-110" />
      {hasStories ? (
        <>
          {/* Сегментное кольцо историй */}
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 w-full h-full -rotate-90"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="bcStoryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f97316" />
                <stop offset="50%" stopColor="#ec4899" />
                <stop offset="100%" stopColor="#fbbf24" />
              </linearGradient>
            </defs>
            {stories.map((s, i) => (
              <circle
                key={s.id}
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke={seen.includes(s.id) ? "#3f3f46" : "url(#bcStoryGrad)"}
                strokeWidth={STROKE}
                strokeLinecap={n > 1 ? "round" : "butt"}
                strokeDasharray={`${DASH} ${C - DASH}`}
                strokeDashoffset={-i * SEG}
              />
            ))}
          </svg>
          <div className="absolute inset-[5px] rounded-full bg-black overflow-hidden ring-1 ring-black/50">
            {img}
          </div>
        </>
      ) : (
        <div className="relative w-full h-full rounded-full bg-black ring-2 ring-orange-500/50 md:ring-1 md:ring-neutral-600 group-hover:ring-orange-500/60 overflow-hidden transition-all">
          {img}
        </div>
      )}
    </div>
  );

  // Историй нет — логотип просто ведёт на главную.
  if (!hasStories) {
    return (
      <Link href="/" className="shrink-0 flex items-center min-w-0 group">
        {logoVisual}
      </Link>
    );
  }

  // Истории есть — логотип открывает меню «Истории / На главную».
  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        className="flex items-center group"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Меню: истории или на главную"
      >
        {logoVisual}
        {/* Точка-индикатор новых историй */}
        {unseenCount > 0 && (
          <span className="absolute top-1 right-1 h-3 w-3 rounded-full bg-orange-500 ring-2 ring-neutral-950" />
        )}
      </button>

      {menuOpen && (
        <div className="absolute left-0 top-full mt-2 z-50 w-56 rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl p-1.5 animate-in fade-in slide-in-from-top-1">
          <Link
            href="/"
            onClick={() => setMenuOpen(false)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-white hover:bg-neutral-800 transition-colors"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-800 shrink-0">
              <Home className="h-4 w-4 text-neutral-300" />
            </span>
            <span className="flex-1 font-medium">На главную</span>
          </Link>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setViewerOpen(true);
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-white hover:bg-neutral-800 transition-colors"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-orange-500 via-pink-500 to-amber-400 shrink-0">
              <Play className="h-4 w-4 text-white fill-white" />
            </span>
            <span className="flex-1 font-medium">Истории</span>
            {unseenCount > 0 && (
              <span className="text-xs font-semibold text-orange-400 bg-orange-500/15 px-2 py-0.5 rounded-full">
                {unseenCount} нов.
              </span>
            )}
          </button>
        </div>
      )}

      {viewerOpen && (
        <StoryViewer
          stories={stories}
          onClose={() => setViewerOpen(false)}
          onSeen={markSeen}
        />
      )}
    </div>
  );
}
