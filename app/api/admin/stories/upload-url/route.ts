import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import {
  createStoryUploadUrl,
  isStoriesStorageConfigured,
} from "@/lib/stories-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Выдаёт подписанную ссылку для прямой загрузки медиа истории в S3.
 * Браузер потом делает PUT по ней (мимо сервера/прокси — без лимита тела).
 */
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

  const body = await request.json().catch(() => ({}));
  const contentType =
    typeof body.contentType === "string" ? body.contentType : "";
  const ext = typeof body.ext === "string" ? body.ext : "";

  if (!contentType.startsWith("video/") && !contentType.startsWith("image/")) {
    return NextResponse.json(
      { error: "Только видео или изображение" },
      { status: 415 }
    );
  }

  try {
    const { uploadUrl, publicUrl } = await createStoryUploadUrl(
      contentType,
      ext
    );
    return NextResponse.json({ uploadUrl, publicUrl });
  } catch (e) {
    console.error("upload-url error:", e);
    return NextResponse.json(
      { error: "Не удалось создать ссылку загрузки" },
      { status: 500 }
    );
  }
}
