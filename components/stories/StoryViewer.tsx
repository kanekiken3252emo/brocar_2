"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { safeLinkUrl } from "@/lib/utils";

export type Story = {
  id: number;
  title?: string | null;
  mediaUrl: string;
  mediaType: "image" | "video";
  linkUrl?: string | null;
  durationMs: number;
};

const IMAGE_TICK = 50; // мс — шаг таймера прогресса фото

/**
 * Полноэкранный просмотрщик историй (как в ВК/ТГ): полоски прогресса,
 * авто-перелистывание, тап влево/вправо, пауза по зажатию, свайп вниз/крестик
 * для закрытия, поддержка видео и фото.
 *
 * Рендерится порталом в document.body — чтобы fixed-позиционирование не
 * ломалось из-за transform-предков (логотип/шапка) и оверлей был поверх всего.
 */
export default function StoryViewer({
  stories,
  startIndex = 0,
  onClose,
  onSeen,
}: {
  stories: Story[];
  startIndex?: number;
  onClose: () => void;
  onSeen?: (id: number) => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0); // 0..1 текущей истории
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [mounted, setMounted] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const elapsedRef = useRef(0);
  const pointerRef = useRef<{
    x: number;
    y: number;
    t: number;
    moved: boolean;
  } | null>(null);

  const current = stories[index];

  const goNext = useCallback(() => {
    setIndex((i) => {
      if (i >= stories.length - 1) {
        onClose();
        return i;
      }
      return i + 1;
    });
  }, [stories.length, onClose]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : 0));
  }, []);

  useEffect(() => setMounted(true), []);

  // Сброс прогресса при смене истории + отметка «просмотрено».
  useEffect(() => {
    elapsedRef.current = 0;
    setProgress(0);
    setPaused(false);
    if (current && onSeen) onSeen(current.id);
    // onSeen намеренно не в зависимостях: родитель пересоздаёт его каждый рендер,
    // а нам нужен сброс только при смене истории.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Блокируем скролл body, пока открыто.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Клавиатура: Esc — закрыть, стрелки — навигация.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goNext, goPrev]);

  // Прогресс для фото (таймер).
  useEffect(() => {
    if (!current || current.mediaType !== "image") return;
    if (paused) return;
    const duration = Math.max(current.durationMs || 5000, 1000);
    const id = setInterval(() => {
      elapsedRef.current += IMAGE_TICK;
      const p = Math.min(elapsedRef.current / duration, 1);
      setProgress(p);
      if (p >= 1) {
        clearInterval(id);
        goNext();
      }
    }, IMAGE_TICK);
    return () => clearInterval(id);
  }, [current, paused, goNext]);

  // Видео: пауза/возобновление синхронизируем с состоянием.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !current || current.mediaType !== "video") return;
    if (paused) v.pause();
    else v.play().catch(() => {});
  }, [paused, current]);

  if (!current) return null;
  if (!mounted) return null;

  const linkHref = safeLinkUrl(current.linkUrl);

  // ── Жесты ──
  const onPointerDown = (e: React.PointerEvent) => {
    pointerRef.current = {
      x: e.clientX,
      y: e.clientY,
      t: Date.now(),
      moved: false,
    };
    setPaused(true); // зажатие = пауза
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = pointerRef.current;
    if (!p) return;
    if (Math.abs(e.clientY - p.y) > 10 || Math.abs(e.clientX - p.x) > 10)
      p.moved = true;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const p = pointerRef.current;
    pointerRef.current = null;
    setPaused(false);
    if (!p) return;
    const dt = Date.now() - p.t;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    // Свайп вниз — закрыть.
    if (dy > 90 && Math.abs(dy) > Math.abs(dx)) {
      onClose();
      return;
    }
    // Быстрый тап (не зажатие, не свайп) — навигация по зонам экрана.
    if (dt < 250 && !p.moved) {
      const el = e.currentTarget as HTMLElement;
      const w = el.clientWidth;
      const x = e.clientX - el.getBoundingClientRect().left;
      if (x < w * 0.35) goPrev();
      else goNext();
    }
    // Иначе это было зажатие (пауза) — просто возобновили.
  };

  const content = (
    <div className="fixed inset-0 z-[80] bg-black flex items-center justify-center select-none">
      {/* Полоски прогресса */}
      <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {stories.map((s, i) => (
          <div
            key={s.id}
            className="h-1 flex-1 rounded-full bg-white/30 overflow-hidden"
          >
            <div
              className="h-full bg-white rounded-full"
              style={{
                width:
                  i < index
                    ? "100%"
                    : i === index
                    ? `${progress * 100}%`
                    : "0%",
              }}
            />
          </div>
        ))}
      </div>

      {/* Шапка: бренд + звук + закрыть */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between gap-3 px-2 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        <div className="flex items-center gap-2 min-w-0 pl-2">
          <div className="h-8 w-8 rounded-full bg-black ring-1 ring-white/30 overflow-hidden shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/Logo_Brocar.webp"
              alt="BroCar"
              className="w-full h-full object-contain brightness-125"
            />
          </div>
          <span className="text-white font-semibold text-sm truncate">
            BroCar
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0 pointer-events-auto">
          {current.mediaType === "video" && (
            <button
              onClick={() => setMuted((m) => !m)}
              className="flex h-11 w-11 items-center justify-center text-white/90 hover:text-white"
              aria-label={muted ? "Включить звук" : "Выключить звук"}
            >
              {muted ? (
                <VolumeX className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </button>
          )}
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center text-white/90 hover:text-white"
            aria-label="Закрыть"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Медиа + зоны тапа */}
      <div
        className="relative w-full h-full max-w-[480px] mx-auto flex items-center justify-center touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          pointerRef.current = null;
          setPaused(false);
        }}
      >
        {current.mediaType === "video" ? (
          <video
            key={current.id}
            ref={videoRef}
            src={current.mediaUrl}
            className="w-full h-full object-contain pointer-events-none"
            autoPlay
            muted={muted}
            playsInline
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration > 0)
                setProgress(Math.min(v.currentTime / v.duration, 1));
            }}
            onEnded={goNext}
            onLoadedMetadata={(e) => {
              e.currentTarget.muted = muted;
            }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={current.id}
            src={current.mediaUrl}
            alt={current.title || "История"}
            className="w-full h-full object-contain pointer-events-none"
          />
        )}

        {/* Подпись + кнопка «Подробнее» */}
        {(current.title || linkHref) && (
          <div className="absolute bottom-0 left-0 right-0 p-4 pb-7 bg-gradient-to-t from-black/70 to-transparent">
            {current.title && (
              <p className="text-white text-base font-medium mb-2 leading-snug">
                {current.title}
              </p>
            )}
            {linkHref && (
              <a
                href={linkHref}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-xl transition-colors"
              >
                Подробнее <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Десктоп-стрелки */}
      {index > 0 && (
        <button
          onClick={goPrev}
          className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white"
          aria-label="Назад"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {index < stories.length - 1 && (
        <button
          onClick={goNext}
          className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white"
          aria-label="Вперёд"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
    </div>
  );

  return createPortal(content, document.body);
}
