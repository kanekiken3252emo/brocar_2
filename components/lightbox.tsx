"use client";

import { useEffect, useCallback } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";

export interface LightboxImage {
  src: string;
  alt: string;
  caption?: string;
}

interface LightboxProps {
  images: LightboxImage[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function Lightbox({ images, currentIndex, onClose, onNavigate }: LightboxProps) {
  const current = images[currentIndex];
  const hasMultiple = images.length > 1;

  const handlePrev = useCallback(() => {
    onNavigate((currentIndex - 1 + images.length) % images.length);
  }, [currentIndex, images.length, onNavigate]);

  const handleNext = useCallback(() => {
    onNavigate((currentIndex + 1) % images.length);
  }, [currentIndex, images.length, onNavigate]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasMultiple) handlePrev();
      if (e.key === "ArrowRight" && hasMultiple) handleNext();
    }
    document.addEventListener("keydown", handleKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, handlePrev, handleNext, hasMultiple]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Close */}
      <button
        className="absolute top-4 right-4 z-10 w-10 h-10 bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700/60 rounded-xl flex items-center justify-center text-neutral-300 hover:text-white transition-colors"
        onClick={onClose}
        aria-label="Закрыть"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Prev */}
      {hasMultiple && (
        <button
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700/60 rounded-xl flex items-center justify-center text-neutral-300 hover:text-white transition-colors"
          onClick={(e) => { e.stopPropagation(); handlePrev(); }}
          aria-label="Предыдущее фото"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Image */}
      <div
        className="relative flex items-center justify-center px-16"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative max-w-[88vw] max-h-[85vh]">
          <Image
            src={current.src}
            alt={current.alt}
            width={1400}
            height={1050}
            className="max-w-[88vw] max-h-[85vh] w-auto h-auto object-contain rounded-2xl shadow-2xl"
            priority
          />
          {current.caption && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent rounded-b-2xl px-5 py-4">
              <p className="text-white font-medium text-sm">{current.caption}</p>
            </div>
          )}
        </div>
      </div>

      {/* Next */}
      {hasMultiple && (
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700/60 rounded-xl flex items-center justify-center text-neutral-300 hover:text-white transition-colors"
          onClick={(e) => { e.stopPropagation(); handleNext(); }}
          aria-label="Следующее фото"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Counter */}
      {hasMultiple && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-neutral-900/80 border border-neutral-700/60 rounded-full px-4 py-1.5">
          <span className="text-neutral-300 text-sm tabular-nums font-medium">
            {currentIndex + 1} / {images.length}
          </span>
        </div>
      )}

      {/* Hint */}
      <p className="absolute bottom-5 right-5 text-neutral-600 text-xs hidden md:block">
        ESC — закрыть{hasMultiple ? " · ← → — листать" : ""}
      </p>
    </div>
  );
}

// Small helper icon for hoverable images
export function ZoomInIcon() {
  return (
    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
      <ZoomIn className="h-5 w-5 text-white" />
    </div>
  );
}
