"use client";

import Image from "next/image";
import { useState } from "react";
import { useProductImage } from "@/lib/hooks/useProductImage";

interface Props {
  brand: string | undefined | null;
  article: string | undefined | null;
  alt?: string;
  /** Стиль внешнего контейнера: размеры, скругление, position-классы. */
  className?: string;
  /** sizes для оптимизатора next/image. */
  sizes?: string;
  /** На каком padding-е рисовать картинку внутри (по умолчанию p-3). */
  innerPadding?: string;
}

const PLACEHOLDER = "/photo-soon.png";

export default function ProductImage({
  brand,
  article,
  alt = "Фото товара",
  className,
  sizes,
  innerPadding = "p-3",
}: Props) {
  const { url, loading } = useProductImage(brand, article);
  const [imgLoaded, setImgLoaded] = useState(false);

  // 1. Запрос URL картинки ещё идёт — пульсирующий скелетон.
  if (loading) {
    return (
      <div
        className={`bg-neutral-800 animate-pulse ${className || ""}`}
        aria-label="Загрузка изображения"
      />
    );
  }

  // 2. Картинки у этого товара нет — тёмный плейсхолдер с иконкой.
  if (!url) {
    return (
      <div
        className={`bg-neutral-800 flex items-center justify-center ${className || ""}`}
      >
        <Image
          src={PLACEHOLDER}
          alt={alt}
          width={160}
          height={160}
          className="max-w-[60%] max-h-[60%] object-contain opacity-80"
        />
      </div>
    );
  }

  // 3. Настоящая картинка — белый фон + плавное появление + промежуточный
  //    скелетон пока next/image её не подгрузит.
  return (
    <div
      className={`relative bg-white overflow-hidden ${className || ""}`}
    >
      {!imgLoaded && (
        <div className="absolute inset-0 bg-neutral-200 animate-pulse" />
      )}
      <Image
        src={url}
        alt={alt}
        fill
        sizes={sizes || "(max-width: 768px) 50vw, 33vw"}
        className={`object-contain ${innerPadding} transition-opacity duration-300 ${
          imgLoaded ? "opacity-100" : "opacity-0"
        }`}
        onLoad={() => setImgLoaded(true)}
        unoptimized
      />
    </div>
  );
}
