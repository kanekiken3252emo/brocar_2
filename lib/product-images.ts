import "server-only";
import axios from "axios";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { eq, and, or } from "drizzle-orm";
import { db } from "./db";
import { productImages } from "./db/schema";
import { ShateMAdapter } from "./suppliers/shate-m";
import { ArmtekAdapter } from "./suppliers/armtek";
import { AutotradeAdapter } from "./suppliers/autotrade";

// Результат попытки источника: url картинки (или null) + был ли СБОЙ запроса к
// источнику (в отличие от честного «картинки нет»). При errored=true мы НЕ пишем
// negative-cache — иначе временный сбой внешнего API навсегда оставил бы товар
// без фото.
type ImageResult = { url: string | null; errored: boolean };

// Прямые инстансы адаптеров, чтобы видеть публичные методы для картинок,
// которых нет в типе SupplierAdapter.
const shateM = new ShateMAdapter();
const armtek = new ArmtekAdapter();
const autotrade = new AutotradeAdapter();

// ── S3-хранилище (VK Cloud Object Storage, S3-совместимое) ───────────────────
// Картинки грузятся в S3 (нужны S3_* env). Без них загрузка отключена.

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
    // Таймауты обязательны: у AWS SDK по умолчанию сокет не ограничен — зависший
    // S3-endpoint держал бы PutObject (и слот MISS_LIMIT загрузки картинки)
    // бесконечно, плюс 3 ретрая. 3с на коннект, 10с на запрос, 1 ретрай.
    requestHandler: { connectionTimeout: 3000, requestTimeout: 10000 },
    maxAttempts: 2,
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
    // ВАЖНО: глобальный sharp.concurrency(1) ЗДЕСЬ БОЛЬШЕ НЕ СТАВИМ. Он душил
    // и оптимизатор next/image в этом же процессе: после деплоя (кэш вариантов
    // стёрт) утренний трафик пересчитывал десятки картинок главной через ОДИН
    // поток libvips — картинки висели минутами, посетители видели «мёртвый
    // сайт» (124×499 на /_next/image в логах nginx). На 6 ядрах дефолтная
    // многопоточность libvips безопасна; параллельность НАШИХ обработок
    // ограничена семафором MISS_LIMIT в getOrFetchProductImage.
    sharp.cache({ files: 0, items: 50, memory: 50 }); // ~50 МБ потолок кэша
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

  // Картинки храним в S3 (VK Cloud Object Storage).
  if (!s3Configured()) {
    console.warn("S3 не настроен (S3_* env) — картинка не сохранена");
    return null;
  }
  return uploadBufferToS3(path, outBuffer, contentType);
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
): Promise<ImageResult> {
  try {
    const articleId = await shateM.findArticleId(article, brand);
    if (!articleId) return { url: null, errored: false };

    const contents = await shateM.getArticleContents(articleId);
    const imageContent = contents.find((c) => {
      const t = (c.contentType || "").toLowerCase();
      return t.includes("image") || t.includes("2d");
    });
    if (!imageContent) return { url: null, errored: false };

    const content = await shateM.fetchContent(
      imageContent.contentId,
      imageContent.contentType || "ImageTwoDimensional",
      600,
      600
    );
    if (!content) return { url: null, errored: false };

    const base64 = content.data.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");
    const stored = await uploadBufferToStorage(
      brand,
      article,
      buffer,
      content.mimeType
    );
    return { url: stored, errored: false };
  } catch (error) {
    // Сбой ShATE-M (таймаут/нет ответа) → errored: НЕ кешируем «нет картинки»,
    // товар переподтянется, когда источник оживёт.
    console.error("tryShateM error:", error);
    return { url: null, errored: true };
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
): Promise<ImageResult> {
  try {
    const artid = await armtek.getArtid(article, brand);
    if (!artid) return { url: null, errored: false };

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
      if (stored) return { url: stored, errored: false };
    }
    return { url: null, errored: false };
  } catch (error) {
    console.error("tryArmtek error:", error);
    return { url: null, errored: true };
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
): Promise<ImageResult> {
  try {
    const imageUrl = await autotrade.getProductImageUrl(article, brand);
    if (!imageUrl) return { url: null, errored: false };

    const downloaded = await downloadImage(imageUrl);
    if (!downloaded) return { url: null, errored: false };

    const stored = await uploadBufferToStorage(
      brand,
      article,
      downloaded.buffer,
      downloaded.mimeType
    );
    return { url: stored, errored: false };
  } catch (error) {
    console.error("tryAutotrade error:", error);
    return { url: null, errored: true };
  }
}

/**
 * Запускает источники картинки параллельно и резолвится ПЕРВЫМ ненулевым
 * результатом (картинка найдена) — не дожидаясь самого медленного. Если никто
 * не нашёл — { url: null }. Проигравшие промисы доигрывают в фоне (отменить их
 * нельзя), но это безвредно: ключ один и тот же (brand/article.webp).
 */
function firstImageHit(
  sources: Array<{ source: string; run: () => Promise<ImageResult> }>
): Promise<{ url: string | null; source: string; errored: boolean }> {
  return new Promise((resolve) => {
    let remaining = sources.length;
    let errored = false;
    let done = false;
    if (remaining === 0) {
      resolve({ url: null, source: "none", errored: false });
      return;
    }
    for (const { source, run } of sources) {
      run()
        .then((res) => {
          if (done) return;
          if (res.url) {
            done = true;
            resolve({ url: res.url, source, errored });
            return;
          }
          if (res.errored) errored = true;
          remaining -= 1;
          if (remaining === 0) resolve({ url: null, source: "none", errored });
        })
        .catch((err) => {
          console.error(`product-images: источник ${source} упал:`, err);
          errored = true;
          remaining -= 1;
          if (remaining === 0 && !done)
            resolve({ url: null, source: "none", errored });
        });
    }
  });
}

/**
 * Получить URL картинки товара по (brand, article).
 *
 * Алгоритм:
 *  1. Проверяет кэш в product_images.
 *  2. Если кэша нет — двухуровневый опрос поставщиков:
 *     • Тир 1: Armtek + ShATE-M параллельно, возвращаем первую найденную
 *       картинку (firstImageHit) — у обоих на методы картинок нет
 *       документированных лимитов (у ShATE-M лимит только на «проценку»).
 *     • Тир 2: Autotrade — ТОЛЬКО если первые два промахнулись. У него жёсткий
 *       лимит 1 req/sec на аккаунт (см. throttle в suppliers/autotrade.ts), и
 *       тот же ключ обслуживает живой каталог. При массовом прогреве (сотни
 *       тысяч товаров) дёргать его на каждый товар = упереться в лимит; на
 *       горячем наборе Armtek/ShATE-M и так находят ~99%, поэтому Autotrade
 *       нужен лишь для редкого хвоста.
 *  3. Результат (даже null) кэшируется чтобы не дёргать API повторно.
 *
 * Поле product_images.source отражает, кто предоставил картинку.
 */
// Семафор «промахов»: сколько товаров БЕЗ кэша обрабатываем одновременно
// (походы к поставщикам + sharp + S3). Грид каталога с новыми товарами (после
// утреннего импорта) даёт 20-40 одновременных запросов — без лимита они
// лавиной шли к поставщикам и в sharp, вешая процесс. Сверх лимита сразу
// отдаём null (плейсхолдер) БЕЗ negative-cache — товар доберётся следующим
// заходом или ночным прогревом (WARM_CONCURRENCY=6 вписывается в лимит).
const MISS_LIMIT = 6;
let missInFlight = 0;

export async function getOrFetchProductImage(
  brandRaw: string,
  articleRaw: string
): Promise<string | null> {
  const brand = normalize(brandRaw);
  const article = normalize(articleRaw);
  if (!brand || !article) return null;

  const cached = await lookupCached(brand, article);
  if (cached.found) return cached.url;

  if (missInFlight >= MISS_LIMIT) return null; // перегруз — не кэшируем, добор позже
  missInFlight++;
  try {
    // Тир 1: Armtek + ShATE-M параллельно — оба без лимитов на картинки, оба
    // быстрые. Возвращаем картинку, КАК ТОЛЬКО её нашёл первый из них. Все грузят
    // файл по одному ключу (brand/article.*), поэтому URL одинаковый.
    let { url, source, errored } = await firstImageHit([
      { source: "armtek", run: () => tryArmtek(brand, article) },
      { source: "shate-m", run: () => tryShateM(brand, article) },
    ]);

    // Тир 2: Autotrade — резерв, только если первые два не нашли. Бережём его
    // лимит 1 req/sec (иначе массовый прогрев упрётся в него и заденет каталог).
    if (!url) {
      const at = await tryAutotrade(brand, article);
      if (at.url) {
        url = at.url;
        source = "autotrade";
      }
      errored = errored || at.errored;
    }

    // Кешируем, ТОЛЬКО если нашли картинку ИЛИ её честно нет (без сбоев API). Если
    // опрос упал с ошибкой (внешний источник лёг, как ShATE-M сейчас) — НЕ пишем
    // negative-cache: товар переподтянется при следующем заходе, когда источник
    // оживёт. Иначе временный сбой навсегда оставил бы товар без фото.
    if (url || !errored) {
      await persistCache(brand, article, url, source);
    }
    return url;
  } finally {
    missInFlight--;
  }
}
