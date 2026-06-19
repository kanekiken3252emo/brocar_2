import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stories } from "@/lib/db/schema";
import { and, asc, eq, gt, isNull, or } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Публичный список активных историй для кольца на логотипе.
 * Возвращает только то, что нужно фронту (без служебных полей).
 */
export async function GET() {
  try {
    const rows = await db
      .select({
        id: stories.id,
        title: stories.title,
        mediaUrl: stories.mediaUrl,
        mediaType: stories.mediaType,
        linkUrl: stories.linkUrl,
        durationMs: stories.durationMs,
      })
      .from(stories)
      .where(
        and(
          eq(stories.isActive, true),
          or(isNull(stories.expiresAt), gt(stories.expiresAt, new Date()))
        )
      )
      .orderBy(asc(stories.sortOrder), asc(stories.id));

    return NextResponse.json(
      { stories: rows },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    // Таблицы может ещё не быть / БД недоступна — не роняем сайт.
    console.error("/api/stories error:", error);
    return NextResponse.json({ stories: [] });
  }
}
