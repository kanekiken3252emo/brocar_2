import "server-only";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import { eq, and, or } from "drizzle-orm";
import { db } from "./db";
import { productImages } from "./db/schema";
import { ShateMAdapter } from "./suppliers/shate-m";
import { ArmtekAdapter } from "./suppliers/armtek";

const BUCKET = "product-images";

// Прямые инстансы адаптеров, чтобы видеть публичные методы для картинок,
// которых нет в типе SupplierAdapter.
const shateM = new ShateMAdapter();
const armtek = new ArmtekAdapter();

let cachedStorage: ReturnType<typeof createClient> | null = null;

function getStorageClient() {
  if (cachedStorage) return cachedStorage;
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY обязательны для работы с product-images"
    );
  }
  cachedStorage = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
  return cachedStorage;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function extFromMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("webp")) return "webp";
  if (m.includes("png")) return "png";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("gif")) return "gif";
  return "bin";
}

function safeSegment(value: string): string {
  return value.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "");
}

/**
 * Загрузить буфер в Supabase Storage и вернуть публичный URL.
 */
async function uploadBufferToStorage(
  brand: string,
  article: string,
  buffer: Buffer,
  mimeType: string
): Promise<string | null> {
  if (buffer.length === 0) return null;

  const ext = extFromMime(mimeType);
  const path = `${safeSegment(brand) || "_"}/${safeSegment(article) || "_"}.${ext}`;

  const storage = getStorageClient();
  const { error } = await storage.storage.from(BUCKET).upload(path, buffer, {
    contentType: mimeType,
    upsert: true,
  });
  if (error) {
    console.error("product-images upload error:", error.message);
    return null;
  }

  const { data } = storage.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl ?? null;
}

/**
 * Скачать картинку с произвольного URL → буфер + mime-type.
 * Используется для Armtek CDN, где данные приходят сразу бинарём,
 * а не в виде data-URI как у ShATE-M.
 */
async function downloadImage(
  url: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const resp = await axios.get<ArrayBuffer>(url, {
      responseType: "arraybuffer",
      timeout: 8000,
      validateStatus: (s) => s === 200,
      headers: {
        "User-Agent": "Mozilla/5.0 BroCar/1.0",
      },
    });
    const mimeType =
      (resp.headers["content-type"] as string | undefined) || "image/webp";
    return { buffer: Buffer.from(resp.data), mimeType };
  } catch {
    return null;
  }
}

async function lookupCached(
  brand: string,
  article: string
): Promise<{ found: true; url: string | null } | { found: false }> {
  const rows = await db
    .select({ imageUrl: productImages.imageUrl })
    .from(productImages)
    .where(
      and(eq(productImages.brand, brand), eq(productImages.article, article))
    )
    .limit(1);
  if (rows.length === 0) return { found: false };
  return { found: true, url: rows[0].imageUrl ?? null };
}

/**
 * Batch-вариант lookupCached: один SELECT по списку (brand, article).
 * Используется на серверной стороне (роуты каталога/поиска), чтобы вернуть
 * клиенту картинки одним JSON'ом — без N+1 запросов к /api/product-image.
 *
 * Ключ возвращаемой Map — `${нормализованный brand}|${нормализованный article}`,
 * чтобы клиенту было удобно матчить (см. cacheKey в useProductImage).
 *
 * Значение:
 *   - строка URL → картинка есть, её можно сразу отрисовать
 *   - null         → negative cache (пробовали, у поставщиков картинки нет)
 *   - отсутствие в Map → ещё не пробовали, клиент сходит в /api/product-image
 *
 * Чанкуется по 200 пар: один большой or-chain Postgres переварит, но размер
 * SQL'а лучше держать в разумных пределах.
 */
export async function lookupCachedBatch(
  pairs: Array<{ brand: string; article: string }>
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  if (pairs.length === 0) return result;

  // Дедуп — одни и те же (brand,article) могут прийти из разных групп
  const seen = new Set<string>();
  const normalized: Array<{ brand: string; article: string; key: string }> = [];
  for (const p of pairs) {
    const b = normalize(p.brand);
    const a = normalize(p.article);
    if (!b || !a) continue;
    const key = `${b}|${a}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({ brand: b, article: a, key });
  }

  const CHUNK = 200;
  for (let i = 0; i < normalized.length; i += CHUNK) {
    const chunk = normalized.slice(i, i + CHUNK);
    const conditions = chunk.map((p) =>
      and(eq(productImages.brand, p.brand), eq(productImages.article, p.article))
    );

    const rows = await db
      .select({
        brand: productImages.brand,
        article: productImages.article,
        imageUrl: productImages.imageUrl,
      })
      .from(productImages)
      .where(or(...conditions));

    for (const r of rows) {
      const key = `${r.brand}|${r.article}`;
      result.set(key, r.imageUrl ?? null);
    }
  }

  return result;
}

/**
 * Обогащение списка групп товаров полем imageUrl из кэша product_images.
 * Применяется в API-роутах каталога/поиска прямо перед `return groups` —
 * чтобы клиент посеял свой in-memory cache и не делал N round-trip'ов
 * на отрисовке грида карточек.
 *
 * Значение imageUrl:
 *   undefined → в кэше нет, клиент сам сходит в /api/product-image
 *   null      → negative cache, сразу плейсхолдер
 *   string    → готовый URL картинки
 */
export async function enrichGroupsWithImages<
  T extends { brand: string; article: string }
>(groups: T[]): Promise<Array<T & { imageUrl?: string | null }>> {
  if (groups.length === 0) return groups as Array<T & { imageUrl?: string | null }>;

  try {
    const cache = await lookupCachedBatch(
      groups.map((g) => ({ brand: g.brand, article: g.article }))
    );

    return groups.map((g) => {
      const key = `${normalize(g.brand)}|${normalize(g.article)}`;
      const cached = cache.get(key);
      // hasOwn-эквивалент через Map.has чтобы отличить undefined (нет в кэше)
      // от null (в кэше, но картинки нет).
      if (cache.has(key)) {
        return { ...g, imageUrl: cached };
      }
      return g as T & { imageUrl?: string | null };
    });
  } catch (error) {
    console.error("enrichGroupsWithImages error:", error);
    return groups as Array<T & { imageUrl?: string | null }>;
  }
}

async function persistCache(
  brand: string,
  article: string,
  imageUrl: string | null,
  source: string
): Promise<void> {
  try {
    await db
      .insert(productImages)
      .values({ brand, article, imageUrl, source })
      .onConflictDoUpdate({
        target: [productImages.brand, productImages.article],
        set: { imageUrl, source },
      });
  } catch (error) {
    console.error("product-images persist cache error:", error);
  }
}

/**
 * Источник №1 — ShATE-M. Хорошо покрывает шины, базовые расходники.
 * Возвращает публичный URL в Supabase Storage или null.
 */
async function tryShateM(
  brand: string,
  article: string
): Promise<string | null> {
  try {
    const articleId = await shateM.findArticleId(article, brand);
    if (!articleId) return null;

    const contents = await shateM.getArticleContents(articleId);
    const imageContent = contents.find((c) => {
      const t = (c.contentType || "").toLowerCase();
      return t.includes("image") || t.includes("2d");
    });
    if (!imageContent) return null;

    const content = await shateM.fetchContent(
      imageContent.contentId,
      imageContent.contentType || "ImageTwoDimensional",
      600,
      600
    );
    if (!content) return null;

    const base64 = content.data.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");
    return uploadBufferToStorage(brand, article, buffer, content.mimeType);
  } catch (error) {
    console.error("tryShateM error:", error);
    return null;
  }
}

/**
 * Источник №2 — Armtek (fallback). У них обширный каталог автозапчастей,
 * картинки лежат на img.armtek.ru. Метода для прямого получения картинки в
 * API нет — конструируем URL по ARTID (выясняется поисковым запросом).
 *
 * Перебираем размеры: 500x500 (лучшее качество), затем 230x230 (известно что
 * есть на их витрине).
 */
async function tryArmtek(
  brand: string,
  article: string
): Promise<string | null> {
  try {
    const artid = await armtek.getArtid(article, brand);
    if (!artid) return null;

    for (const size of ["500x500", "230x230"]) {
      const imageUrl = ArmtekAdapter.buildImageUrl(artid, size);
      const downloaded = await downloadImage(imageUrl);
      if (!downloaded) continue;

      const stored = await uploadBufferToStorage(
        brand,
        article,
        downloaded.buffer,
        downloaded.mimeType
      );
      if (stored) return stored;
    }
    return null;
  } catch (error) {
    console.error("tryArmtek error:", error);
    return null;
  }
}

/**
 * Получить URL картинки товара по (brand, article).
 *
 * Алгоритм:
 *  1. Проверяет кэш в product_images.
 *  2. Если кэша нет — пробует поставщиков по очереди:
 *       а) ShATE-M (data-URI base64 → Storage)
 *       б) Armtek (img.armtek.ru CDN → скачать → Storage)
 *  3. Результат (даже null) кэшируется чтобы не дёргать API повторно.
 *
 * Поле product_images.source отражает кто реально предоставил картинку.
 */
export async function getOrFetchProductImage(
  brandRaw: string,
  articleRaw: string
): Promise<string | null> {
  const brand = normalize(brandRaw);
  const article = normalize(articleRaw);
  if (!brand || !article) return null;

  const cached = await lookupCached(brand, article);
  if (cached.found) return cached.url;

  // Армтек первый — у них покрытие шире и end-to-end быстрее
  // (getArtid + скачивание ~1.5s против ShATE-M find+contents+fetch ~2-3s).
  let url: string | null = await tryArmtek(brand, article);
  let source = "armtek";

  if (!url) {
    url = await tryShateM(brand, article);
    if (url) source = "shate-m";
  }

  // Если никто не дал картинку — negative cache всё равно пишем, source
  // оставляем последним опробованным (shate-m), чтобы видеть в БД что
  // мы прошли весь fallback-chain.
  if (!url) source = "shate-m";

  await persistCache(brand, article, url, source);
  return url;
}
