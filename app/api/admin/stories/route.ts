import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { stories } from "@/lib/db/schema";
import { asc, desc } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { safeLinkUrl } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Поля, которые отдаём клиенту (без createdAt/expiresAt) — совпадает с AdminStory.
const STORY_FIELDS = {
  id: stories.id,
  title: stories.title,
  mediaUrl: stories.mediaUrl,
  mediaType: stories.mediaType,
  linkUrl: stories.linkUrl,
  durationMs: stories.durationMs,
  sortOrder: stories.sortOrder,
  isActive: stories.isActive,
} as const;

/** Список всех историй для админки. */
export async function GET() {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rows = await db
    .select(STORY_FIELDS)
    .from(stories)
    .orderBy(asc(stories.sortOrder), asc(stories.id));
  return NextResponse.json({ stories: rows });
}

/**
 * Создание записи истории. Медиа уже загружено напрямую в S3 (presigned-URL),
 * сюда приходит только готовая ссылка + метаданные (JSON, без файла).
 */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const mediaUrl =
    typeof body.mediaUrl === "string" ? body.mediaUrl.trim() : "";
  const mediaType =
    body.mediaType === "video"
      ? "video"
      : body.mediaType === "image"
      ? "image"
      : null;

  if (!/^https?:\/\//i.test(mediaUrl) || !mediaType) {
    return NextResponse.json(
      { error: "Некорректные данные истории" },
      { status: 400 }
    );
  }
  // Медиа должно лежать в нашем S3 — чужие ссылки не принимаем.
  const base = (process.env.S3_PUBLIC_BASE || "").replace(/\/+$/, "");
  if (base && !mediaUrl.startsWith(base)) {
    return NextResponse.json(
      { error: "Недопустимый источник медиа" },
      { status: 400 }
    );
  }

  const title =
    typeof body.title === "string" ? body.title.trim() || null : null;
  const linkUrl = safeLinkUrl(
    typeof body.linkUrl === "string" ? body.linkUrl : null
  );
  const durationRaw = Number(body.durationMs);
  const durationMs =
    Number.isFinite(durationRaw) && durationRaw > 0
      ? Math.min(Math.max(Math.round(durationRaw), 1000), 60000)
      : 5000;

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
    .returning(STORY_FIELDS);

  return NextResponse.json({ story: row });
}
