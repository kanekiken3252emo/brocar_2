"use client";

import { useState } from "react";
import NextImage from "next/image";
import { Lightbox, ZoomInIcon } from "./lightbox";

const IMAGE = [
  {
    src: "/bro-car-shop-photo-outside.webp",
    alt: "Фасад магазина BroCar",
    caption: "Фасад магазина BroCar — г. Екатеринбург, ул. Заводская, 16",
  },
];

export function ContactsShopImage() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="w-full md:w-64 h-44 rounded-xl overflow-hidden shrink-0 group cursor-zoom-in relative"
        onClick={() => setOpen(true)}
        aria-label="Открыть фото магазина"
      >
        <NextImage
          src="/bro-car-shop-photo-outside.webp"
          alt="Фасад магазина BroCar"
          width={400}
          height={300}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center">
          <ZoomInIcon />
        </div>
      </button>

      {open && (
        <Lightbox
          images={IMAGE}
          currentIndex={0}
          onClose={() => setOpen(false)}
          onNavigate={() => {}}
        />
      )}
    </>
  );
}
