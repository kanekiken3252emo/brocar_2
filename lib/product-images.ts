import "server-only";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { eq, and, or } from "drizzle-orm";
import { db } from "./db";
import { productImages } from "./db/schema";
import { ShateMAdapter } from "./suppliers/shate-m";
import { ArmtekAdapter } from "./suppliers/armtek";
import { AutotradeAdapter } from "./suppliers/autotrade";

const BUCKET = "product-images";

// Прямые инстансы адаптеров, чтобы видеть публичные методы для картинок,
// которых нет в типе SupplierAdapter.
const shateM = new ShateMAdapter();
const armtek = new ArmtekAdapter();
const autotrade = new AutotradeAdapter();

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

// ── S3-хранилище (VK Cloud Object Storage, S3-совместимое) ───────────────────
// Если заданы S3_* переменные — картинки грузятся в S3 вместо Supabase Storage.
// Так переезд бесшовный: пока ключи не прописаны, всё работает на Supabase.

let cachedS3: S3Client | null = null;

/** Настроено ли S3-хранилище (заданы endpoint + ключи + бакет). */
function s3Configured(): boolean {
  return Boolean(
    process.env.S3_ENDPOINT &&
      process.env.S3_ACCESS_KEY &&
      process.env.S3_SECRET_KEY &&
      process.env.S3_BUCKET
  );
}

function getS3Client(): S3Client {
  if (cachedS3) return cachedS3;
  cachedS3 = new S3Client({
    region: process.env.S3_REGION || "ru-msk",
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY as string,
      secretAccessKey: process.env.S3_SECRET_KEY as string,
    },
    // VK Cloud адресует бакет как поддомен (bucket.hb.ru-msk...), это
    // virtual-hosted style → forcePathStyle=false.
    forcePathStyle: false,
  });
  return cachedS3;
}

/** Загрузить буфер в S3 и вернуть публичный URL (объект помечается public-read). */
async function uploadBufferToS3(
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<string | null> {
  const bucket = process.env.S3_BUCKET as string;
  try {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: path,
        Body: buffer,
        ContentType: contentType,
        // Публичное чтение: у VK Cloud нет «публичного бакета» в один тумблер —
        // доступность задаётся ACL на объект.
        ACL: "public-read",
        // Длинный неизменяемый кэш: путь детерминирован (brand/article.webp),
        // при обновлении мы перезаписываем тот же ключ. Без этого заголовка
        // next/image перекэшировал бы картинку каждые 60 сек (minimumCacheTTL),
        // а браузер не держал бы её — отсюда «подтормаживания» на повторных показах.
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
  } catch (error) {
    console.error("product-images S3 upload error:", (error as Error).message);
    return null;
  }

  const base = (
    process.env.S3_PUBLIC_BASE || `${process.env.S3_ENDPOINT}/${bucket}`
  ).replace(/\/+$/, "");
  return `${base}/${path}`;
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

  // Сжимаем перед сохранением: ужимаем до 300px (по большей стороне) и
  // переводим в webp. Это ~4-5× экономии места (важно на Free-тарифе Supabase,
  // лимит 1 ГБ) и более лёгкая, быстрая отдача картинки. Если формат необычный
  // и sharp не справился — грузим оригинал.
  let outBuffer = buffer;
  let ext = extFromMime(mimeType);
  let contentType = mimeType;
  try {
    // Загружаем sharp ЛЕНИВО (динамический импорт): если нативный модуль не
    // доступен в рантайме (сборка/платформа), модуль product-images не падает,
    // а просто грузим оригинал без сжатия. Раньше статический import sharp
    // ронял ВСЕ роуты, использующие этот файл (категории/поиск/картинки).
    const sharp = (await import("sharp")).default;
    outBuffer = await sharp(buffer)
      .resize(300, 300, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer();
    ext = "webp";
    contentType = "image/webp";
  } catch (e) {
    console.warn(
      "product-images: sharp недоступен/ошибка — гружу оригинал:",
      (e as Error).message
    );
  }

  const path = `${safeSegment(brand) || "_"}/${safeSegment(article) || "_"}.${ext}`;

  // Новое хранилище: S3 (VK Cloud), если заданы ключи. Иначе — Supabase Storage.
  if (s3Configured()) {
    return uploadBufferToS3(path, outBuffer, contentType);
  }

  const storage = getStorageClient();
  const { error } = await storage.storage.from(BUCKET).upload(path, outBuffer, {
    contentType,
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
 * ВАЖНО: передаём клиенту ТОЛЬКО готовые URL'ы. Negative cache
 * (image_url=null) намеренно не пробрасываем — иначе при старом «битом»
 * кэше клиент бы сразу рисовал плейсхолдер и никогда не пытался
 * переподтянуть картинку через /api/product-image, даже если логика
 * матчинга у поставщиков стала умнее. Так что для null-записей
 * клиент пойдёт через старый путь (и getOrFetchProductImage решит
 * сам, переподтягивать или вернуть null).
 *
 * Значение imageUrl:
 *   undefined → не пробрасываем, клиент сам сходит в /api/product-image
 *   string    → готовый URL картинки, клиент засеет кэш и нарисует сразу
 */
export async function enrichGroupsWithImages<
  T extends { brand: string; article: string }
>(groups: T[]): Promise<Array<T & { imageUrl?: string }>> {
  if (groups.length === 0) return groups as Array<T & { imageUrl?: string }>;

  try {
    const cache = await lookupCachedBatch(
      groups.map((g) => ({ brand: g.brand, article: g.article }))
    );

    return groups.map((g) => {
      const key = `${normalize(g.brand)}|${normalize(g.article)}`;
      const cached = cache.get(key);
      if (typeof cached === "string" && cached.length > 0) {
        return { ...g, imageUrl: cached };
      }
      return g as T & { imageUrl?: string };
    });
  } catch (error) {
    console.error("enrichGroupsWithImages error:", error);
    return groups as Array<T & { imageUrl?: string }>;
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
 * Источник №3 — Autotrade. У них картинки на static.autotrade.su,
 * получаем URL через getItemsByQuery (strict=1) — в ответе сразу
 * поле photo. Точное совпадение бренда обязательно, иначе fallback
 * на «единственный товар по бренду» (см. adapter.getProductImageUrl).
 *
 * Важно: rate-limit у Autotrade 1 req/sec — встроенный throttle
 * в adapter'е сериализует все запросы автоматически.
 */
async function tryAutotrade(
  brand: string,
  article: string
): Promise<string | null> {
  try {
    const imageUrl = await autotrade.getProductImageUrl(article, brand);
    if (!imageUrl) return null;

    const downloaded = await downloadImage(imageUrl);
    if (!downloaded) return null;

    return uploadBufferToStorage(
      brand,
      article,
      downloaded.buffer,
      downloaded.mimeType
    );
  } catch (error) {
    console.error("tryAutotrade error:", error);
    return null;
  }
}

/**
 * Запускает источники картинки параллельно и резолвится ПЕРВЫМ ненулевым
 * результатом (картинка найдена) — не дожидаясь самого медленного. Если никто
 * не нашёл — { url: null }. Проигравшие промисы доигрывают в фоне (отменить их
 * нельзя), но это безвредно: ключ один и тот же (brand/article.webp).
 */
function firstImageHit(
  sources: Array<{ source: string; run: () => Promise<string | null> }>
): Promise<{ url: string | null; source: string }> {
  return new Promise((resolve) => {
    let remaining = sources.length;
    let done = false;
    if (remaining === 0) {
      resolve({ url: null, source: "none" });
      return;
    }
    for (const { source, run } of sources) {
      run()
        .then((url) => {
          if (done) return;
          if (url) {
            done = true;
            resolve({ url, source });
            return;
          }
          remaining -= 1;
          if (remaining === 0) resolve({ url: null, source: "none" });
        })
        .catch((err) => {
          console.error(`product-images: источник ${source} упал:`, err);
          remaining -= 1;
          if (remaining === 0 && !done) resolve({ url: null, source: "none" });
        });
    }
  });
}

/**
 * Получить URL картинки товара по (brand, article).
 *
 * Алгоритм:
 *  1. Проверяет кэш в product_images.
 *  2. Если кэша нет — пробует всех поставщиков параллельно и возвращает
 *     картинку, КАК ТОЛЬКО её нашёл первый из них (firstImageHit), не
 *     дожидаясь самого медленного. Все грузят файл по одному ключу
 *     (brand/article.webp), поэтому URL одинаковый.
 *  3. Результат (даже null) кэшируется чтобы не дёргать API повторно.
 *
 * Раньше тут был Promise.all (ждали ВСЕХ) → срок = время самого тормозного
 * поставщика. Теперь срок = время самого быстрого, у кого картинка есть.
 *
 * Поле product_images.source отражает кто первым предоставил картинку.
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

  // Опрашиваем поставщиков параллельно и возвращаем картинку, КАК ТОЛЬКО её
  // нашёл первый из них — не дожидаясь самого медленного (раньше тут был
  // Promise.all, и общий срок = время самого тормозного поставщика).
  // Все они грузят файл по одному и тому же ключу (brand/article.webp),
  // поэтому URL одинаковый независимо от источника-победителя.
  const { url, source } = await firstImageHit([
    { source: "armtek", run: () => tryArmtek(brand, article) },
    { source: "shate-m", run: () => tryShateM(brand, article) },
    { source: "autotrade", run: () => tryAutotrade(brand, article) },
  ]);

  await persistCache(brand, article, url, source);
  return url;
}
