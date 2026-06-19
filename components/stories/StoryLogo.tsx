"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
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
 * Логотип BroCar с «кольцом историй». Если есть активные истории — логотип
 * получает градиентное кольцо и по тапу открывает полноэкранный просмотрщик.
 * Если историй нет — обычная ссылка на главную.
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
  const hasUnseen = hasStories && stories.some((s) => !seen.includes(s.id));

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
      className="w-full h-full object-contain brightness-125 md:brightness-100"
      priority
    />
  );

  const logoInner = (
    <div className="relative h-[4.25rem] w-[4.25rem] md:h-20 md:w-20 lg:h-[5.25rem] lg:w-[5.25rem]">
      {/* Оранжевое свечение, чтобы чёрный логотип читался на тёмном фоне. */}
      <div className="absolute inset-0 bg-orange-500/50 md:bg-orange-500/25 rounded-full blur-md md:blur-xl scale-110" />
      {hasStories ? (
        <div
          className={cn(
            "relative w-full h-full rounded-full p-[3px] transition-all",
            hasUnseen
              ? "bg-gradient-to-tr from-orange-500 via-pink-500 to-amber-400"
              : "bg-neutral-600"
          )}
        >
          <div className="w-full h-full rounded-full bg-black overflow-hidden ring-2 ring-black">
            {img}
          </div>
        </div>
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
