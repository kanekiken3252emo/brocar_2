import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { stories } from "@/lib/db/schema";
import { asc, desc } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import {
  uploadStoryMedia,
  isStoriesStorageConfigured,
} from "@/lib/stories-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 60 * 1024 * 1024; // 60 МБ

function extFromMime(mime: string): string | null {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  };
  return map[mime] || null;
}

/** Список всех историй для админки. */
export async function GET() {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rows = await db
    .select()
    .from(stories)
    .orderBy(asc(stories.sortOrder), asc(stories.id));
  return NextResponse.json({ stories: rows });
}

/** Загрузка новой истории: multipart (file + title + linkUrl + durationMs). */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isStoriesStorageConfigured()) {
    return NextResponse.json(
      { error: "S3 не настроен на сервере" },
      { status: 500 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Ожидается multipart/form-data" },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Файл слишком большой (макс. 60 МБ)" },
      { status: 413 }
    );
  }

  const mime = file.type || "";
  const isVideo = mime.startsWith("video/");
  const isImage = mime.startsWith("image/");
  if (!isVideo && !isImage) {
    return NextResponse.json(
      { error: "Только видео или изображение" },
      { status: 415 }
    );
  }

  const title = (form.get("title") as string | null)?.trim() || null;
  const linkUrl = (form.get("linkUrl") as string | null)?.trim() || null;
  const durationRaw = Number(form.get("durationMs"));
  const durationMs =
    Number.isFinite(durationRaw) && durationRaw > 0
      ? Math.min(Math.max(Math.round(durationRaw), 1000), 60000)
      : 5000;

  const inputBuffer = Buffer.from(await file.arrayBuffer());

  let mediaUrl: string;
  let mediaType: "image" | "video";

  try {
    if (isImage) {
      mediaType = "image";
      let outBuffer: Buffer = inputBuffer;
      let contentType = mime;
      let ext = extFromMime(mime) || "jpg";
      // Поджимаем фото (если sharp доступен): max 1080×1920, webp.
      try {
        const sharp = (await import("sharp")).default;
        outBuffer = await sharp(inputBuffer)
          .rotate()
          .resize(1080, 1920, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();
        contentType = "image/webp";
        ext = "webp";
      } catch (e) {
        console.warn("sharp недоступен, грузим оригинал фото:", e);
      }
      mediaUrl = await uploadStoryMedia(outBuffer, contentType, ext);
    } else {
      mediaType = "video";
      const ext = extFromMime(mime) || "mp4";
      mediaUrl = await uploadStoryMedia(inputBuffer, mime, ext);
    }
  } catch (e) {
    console.error("Загрузка истории в S3 не удалась:", e);
    return NextResponse.json(
      { error: "Не удалось загрузить файл в хранилище" },
      { status: 500 }
    );
  }

  // sortOrder = последний + 1 (новые добавляются в конец).
  const [last] = await db
    .select({ sortOrder: stories.sortOrder })
    .from(stories)
    .orderBy(desc(stories.sortOrder))
    .limit(1);
  const sortOrder = (last?.sortOrder ?? 0) + 1;

  const [row] = await db
    .insert(stories)
    .values({
      title,
      mediaUrl,
      mediaType,
      linkUrl,
      durationMs,
      sortOrder,
      isActive: true,
    })
    .returning();

  return NextResponse.json({ story: row });
}
