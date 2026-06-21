"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
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
  /**
   * priority=true отключает lazy-load и даёт preload-подсказку браузеру.
   * Нужно ставить только для картинок, видимых в первом экране (LCP) —
   * иначе теряем выгоду от ленивой загрузки.
   */
  priority?: boolean;
  /**
   * initialUrl — готовый URL картинки от сервера (RSC-шелл). Когда задан,
   * картинка попадает в первый HTML без клиентского запроса /api/product-image.
   */
  initialUrl?: string | null;
}

const PLACEHOLDER = "/photo-soon.png";

export default function ProductImage({
  brand,
  article,
  alt = "Фото товара",
  className,
  sizes,
  innerPadding = "p-3",
  priority = false,
  initialUrl = null,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Видна ли карточка: priority — сразу true; иначе включаем по IntersectionObserver
  // (с запасом 200px), чтобы «холодные» картинки грузились только при подходе к
  // зоне видимости, а не все 20 разом на старте.
  const [inView, setInView] = useState<boolean>(priority);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    if (priority || inView) return;
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          obs.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [priority, inView]);

  const { url, loading } = useProductImage(brand, article, inView, initialUrl);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${url ? "bg-white" : "bg-neutral-800"} ${
        className || ""
      }`}
    >
      {/* 1. URL картинки ещё резолвится (или ждём появления в зоне видимости). */}
      {loading && (
        <div
          className="absolute inset-0 bg-neutral-800 animate-pulse"
          aria-label="Загрузка изображения"
        />
      )}

      {/* 2. Картинки у товара нет — плейсхолдер. */}
      {!loading && !url && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Image
            src={PLACEHOLDER}
            alt={alt}
            width={160}
            height={160}
            className="max-w-[60%] max-h-[60%] object-contain opacity-80"
          />
        </div>
      )}

      {/* 3. Настоящая картинка — плавное появление поверх скелетона. */}
      {!loading && url && (
        <>
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
            priority={priority}
            // Картинки товаров уже лежат в S3 ужатыми до 300px webp (immutable).
            // Повторная оптимизация через /_next/image не уменьшает вес, а лишь
            // добавляет хоп клиент→наш Node и нагрузку sharp на каждый показ грида.
            // Отдаём напрямую из CDN.
            unoptimized
          />
        </>
      )}
    </div>
  );
}
