"use client";

import { useEffect, useState } from "react";

// In-memory кэш URL картинок на время жизни SPA-сессии. Ключ — `brand|article`
// в нижнем регистре. null означает «уже спрашивали — картинки нет».
const memoryCache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

// Ограничитель одновременных запросов к /api/product-image: «холодная»
// картинка резолвится 3-4с (опрос API поставщиков), и без лимита грид из 20
// карточек запускал 20 запросов разом и забивал rate-limit поставщиков.
// Держим не больше MAX_CONCURRENT в полёте, остальные ждут в очереди.
const MAX_CONCURRENT = 5;
let activeCount = 0;
const waitQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (activeCount < MAX_CONCURRENT) {
    activeCount++;
    return Promise.resolve();
  }
  return new Promise((resolve) => waitQueue.push(resolve));
}

function releaseSlot(): void {
  activeCount--;
  const next = waitQueue.shift();
  if (next) {
    activeCount++;
    next();
  }
}

function cacheKey(brand: string, article: string): string {
  return `${brand.trim().toLowerCase()}|${article.trim().toLowerCase()}`;
}

/**
 * Засеять кэш картинок одной парой (brand, article). Используется на страницах
 * каталога после получения списка товаров от сервера, который уже подмешал
 * картинки в JSON-ответ — чтобы useProductImage сразу нашёл URL в памяти и
 * не делал индивидуальный fetch к /api/product-image на каждой карточке.
 *
 * url:
 *   string — готовая картинка, отрисовать сразу
 *   null   — negative cache, плейсхолдер сразу
 */
export function seedProductImageCache(
  brand: string | undefined | null,
  article: string | undefined | null,
  url: string | null
): void {
  if (!brand || !article) return;
  memoryCache.set(cacheKey(brand, article), url);
}

async function fetchProductImage(
  brand: string,
  article: string
): Promise<string | null> {
  const key = cacheKey(brand, article);
  if (memoryCache.has(key)) return memoryCache.get(key) ?? null;

  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    await acquireSlot();
    try {
      const res = await fetch(
        `/api/product-image?brand=${encodeURIComponent(brand)}&article=${encodeURIComponent(article)}`
      );
      if (!res.ok) {
        memoryCache.set(key, null);
        return null;
      }
      const data: { url: string | null } = await res.json();
      memoryCache.set(key, data.url ?? null);
      return data.url ?? null;
    } catch {
      memoryCache.set(key, null);
      return null;
    } finally {
      releaseSlot();
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

export function useProductImage(
  brand: string | undefined | null,
  article: string | undefined | null,
  // enabled=false → не запрашиваем «холодную» картинку (карточка ещё вне зоны
  // видимости). Засеянные/кэшированные URL отдаются сразу независимо от флага.
  enabled: boolean = true,
  // initialUrl — готовый URL картинки, полученный сервером (RSC-шелл карточки
  // товара). Когда он задан, картинка рисуется СРАЗУ (в т.ч. в SSR-HTML) без
  // запроса к /api/product-image. memoryCache не сеется во время рендера (иначе
  // на сервере был бы межзапросный leak) — только в клиентском эффекте ниже.
  initialUrl: string | null = null
): { url: string | null; loading: boolean } {
  const [url, setUrl] = useState<string | null>(() => {
    if (initialUrl) return initialUrl;
    if (!brand || !article) return null;
    const key = cacheKey(brand, article);
    return memoryCache.has(key) ? memoryCache.get(key) ?? null : null;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (initialUrl) return false;
    if (!brand || !article) return false;
    return !memoryCache.has(cacheKey(brand, article));
  });

  useEffect(() => {
    // Сервер уже отдал URL — используем его, сеем клиентский кэш и не ходим в сеть.
    if (initialUrl) {
      if (brand && article) memoryCache.set(cacheKey(brand, article), initialUrl);
      setUrl(initialUrl);
      setLoading(false);
      return;
    }
    if (!brand || !article) {
      setUrl(null);
      setLoading(false);
      return;
    }
    const key = cacheKey(brand, article);
    if (memoryCache.has(key)) {
      setUrl(memoryCache.get(key) ?? null);
      setLoading(false);
      return;
    }

    // Картинки нет в кэше и карточка ещё не видна — ждём (скелетон), не грузим.
    if (!enabled) {
      setLoading(true);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchProductImage(brand, article).then((result) => {
      if (cancelled) return;
      setUrl(result);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [brand, article, enabled, initialUrl]);

  return { url, loading };
}
