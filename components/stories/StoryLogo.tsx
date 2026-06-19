"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
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
 * Логотип BroCar с «кольцом историй» как в Telegram: кольцо разбито на отсеки
 * (по одному на историю). Непросмотренные — цветной градиент, просмотренные —
 * серые. По тапу открывается полноэкранный просмотрщик. Если историй нет —
 * обычная ссылка на главную.
 */
export default function StoryLogo() {
  const [stories, setStories] = useState<Story[]>([]);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<number[]>([]);

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

  const hasStories = stories.length > 0;

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
      src="/Logo_Brocar.webp"
      alt="BroCar"
      width={1200}
      height={1200}
      sizes="84px"
      className="w-full h-full object-contain brightness-125 md:brightness-100"
      priority
    />
  );

  // Геометрия сегментного кольца (viewBox 100×100, масштабируется к размеру лого).
  const n = stories.length;
  const STROKE = 4;
  const R = 50 - STROKE / 2;
  const C = 2 * Math.PI * R;
  const GAP = n > 1 ? 7 : 0; // зазор между отсеками
  const SEG = n > 0 ? C / n : C; // длина одного отсека
  const DASH = Math.max(SEG - GAP, 0.1);

  const logoInner = (
    <div className="relative h-[4.25rem] w-[4.25rem] md:h-20 md:w-20 lg:h-[5.25rem] lg:w-[5.25rem]">
      {/* Свечение, чтобы чёрный логотип читался на тёмном фоне. */}
      <div className="absolute inset-0 bg-orange-500/30 rounded-full blur-md scale-110" />
      {hasStories ? (
        <>
          {/* Сегментное кольцо историй (как в Telegram) */}
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 w-full h-full -rotate-90"
            aria-hidden="true"
          >
            <defs>
              <linearGradient
                id="bcStoryGrad"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
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
          {/* Логотип внутри кольца */}
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

  if (!hasStories) {
    return (
      <Link href="/" className="shrink-0 flex items-center min-w-0 group">
        {logoInner}
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 flex items-center min-w-0 group"
        aria-label="Смотреть истории BroCar"
      >
        {logoInner}
      </button>
      {open && (
        <StoryViewer
          stories={stories}
          onClose={() => setOpen(false)}
          onSeen={markSeen}
        />
      )}
    </>
  );
}
