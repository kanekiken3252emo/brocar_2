import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { stories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { deleteStoryMedia } from "@/lib/stories-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Обновление истории: вкл/выкл, порядок, подпись, ссылка, длительность. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const storyId = Number(id);
  if (!Number.isFinite(storyId)) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body.isActive === "boolean") patch.isActive = body.isActive;
  if (typeof body.sortOrder === "number")
    patch.sortOrder = Math.round(body.sortOrder);
  if (typeof body.title === "string") patch.title = body.title.trim() || null;
  if (typeof body.linkUrl === "string")
    patch.linkUrl = body.linkUrl.trim() || null;
  if (typeof body.durationMs === "number" && body.durationMs > 0)
    patch.durationMs = Math.min(Math.max(Math.round(body.durationMs), 1000), 60000);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "Нет полей для обновления" },
      { status: 400 }
    );
  }

  const [row] = await db
    .update(stories)
    .set(patch)
    .where(eq(stories.id, storyId))
    .returning();

  if (!row) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  return NextResponse.json({ story: row });
}

/** Удаление истории (вместе с файлом в S3). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const storyId = Number(id);
  if (!Number.isFinite(storyId)) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const [row] = await db
    .delete(stories)
    .where(eq(stories.id, storyId))
    .returning();

  if (row) await deleteStoryMedia(row.mediaUrl);
  return NextResponse.json({ ok: true });
}
