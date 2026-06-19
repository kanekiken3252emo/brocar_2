import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

// Хранилище медиа историй. Использует те же S3 (VK Cloud) переменные, что и
// картинки товаров (lib/product-images.ts), но кладёт файлы под префикс stories/.
// Отдельный модуль — чтобы не экспортировать внутренности product-images.

let cachedS3: S3Client | null = null;

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
    // VK Cloud адресует бакет как поддомен → virtual-hosted style.
    forcePathStyle: false,
  });
  return cachedS3;
}

function publicBase(): string {
  return (
    process.env.S3_PUBLIC_BASE ||
    `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}`
  ).replace(/\/+$/, "");
}

export function isStoriesStorageConfigured(): boolean {
  return s3Configured();
}

/** Загружает медиа истории в S3 и возвращает публичный URL. */
export async function uploadStoryMedia(
  buffer: Buffer,
  contentType: string,
  ext: string
): Promise<string> {
  if (!s3Configured()) {
    throw new Error("S3 не настроен (нет S3_ENDPOINT/ключей/бакета)");
  }
  const bucket = process.env.S3_BUCKET as string;
  const rand = Math.random().toString(36).slice(2, 10);
  // Ключ генерится сервером; ext дополнительно чистим — защита от инъекции пути.
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  const key = `stories/${Date.now()}-${rand}.${safeExt}`;
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: "public-read",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return `${publicBase()}/${key}`;
}

/** Удаляет объект истории из S3 по его публичному URL (best-effort). */
export async function deleteStoryMedia(
  url: string | null | undefined
): Promise<void> {
  if (!url || !s3Configured()) return;
  const base = publicBase();
  if (!url.startsWith(base)) return; // чужой/Supabase URL — не трогаем
  const key = url.slice(base.length).replace(/^\/+/, "");
  if (!key) return;
  try {
    await getS3Client().send(
      new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET as string,
        Key: key,
      })
    );
  } catch (e) {
    console.warn("deleteStoryMedia failed:", e);
  }
}
