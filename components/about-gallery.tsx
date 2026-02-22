"use client";

import { useState } from "react";
import Image from "next/image";
import { Lightbox, ZoomInIcon } from "./lightbox";

const GALLERY = [
  {
    src: "/bro-car-place.webp",
    alt: "Интерьер магазина BroCar",
    caption: "Зона консультации — профессиональный подбор запчастей",
  },
  {
    src: "/bro-car-shop-photo-outside.webp",
    alt: "Фасад магазина BroCar",
    caption: "Фасад магазина",
  },
  {
    src: "/bro-car-office.webp",
    alt: "Офис BroCar",
    caption: "Рабочее место",
  },
  {
    src: "/bro-car-stuff.webp",
    alt: "Полки с запчастями Brembo",
    caption: "Тормозные системы Brembo",
  },
  {
    src: "/bro-car-oils.webp",
    alt: "Моторные масла Toyota и Lexus",
    caption: "Оригинальные масла",
  },
  {
    src: "/bro-car-tovary.webp",
    alt: "Ассортимент запчастей BroCar",
    caption: "Широкий ассортимент",
  },
];

const SMALL = GALLERY.slice(1);

export function AboutGallery() {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        {/* Main large photo */}
        <button
          className="col-span-2 row-span-2 relative rounded-2xl overflow-hidden group cursor-zoom-in text-left"
          onClick={() => setLightboxIndex(0)}
          aria-label="Открыть фото: Зона консультации"
        >
          <Image
            src="/bro-car-place.webp"
            alt="Интерьер магазина BroCar"
            width={800}
            height={600}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
            <ZoomInIcon />
          </div>
          <div className="absolute bottom-4 left-4">
            <p className="text-white font-semibold text-lg">Зона консультации</p>
            <p className="text-white/70 text-sm">Профессиональный подбор запчастей</p>
          </div>
        </button>

        {SMALL.map((img, i) => (
          <button
            key={img.src}
            className="relative rounded-2xl overflow-hidden group aspect-[4/3] cursor-zoom-in"
            onClick={() => setLightboxIndex(i + 1)}
            aria-label={`Открыть фото: ${img.caption}`}
          >
            <Image
              src={img.src}
              alt={img.alt}
              width={400}
              height={300}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
              <ZoomInIcon />
            </div>
            <p className="absolute bottom-3 left-3 text-white font-medium text-sm">
              {img.caption}
            </p>
          </button>
        ))}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          images={GALLERY}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </>
  );
}
