import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { news } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEWS_FIELDS = {
  id: news.id,
  title: news.title,
  body: news.body,
  badge: news.badge,
  archived: news.archived,
  publishedAt: news.publishedAt,
} as const;

/** Редактирование новости: заголовок, текст, метка, дата, архивация. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const newsId = Number(id);
  if (!Number.isFinite(newsId)) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") {
    const t = body.title.trim();
    if (!t)
      return NextResponse.json(
        { error: "Заголовок не может быть пустым" },
        { status: 400 }
      );
    patch.title = t;
  }
  if (typeof body.body === "string") {
    const t = body.body.trim();
    if (!t)
      return NextResponse.json(
        { error: "Текст не может быть пустым" },
        { status: 400 }
      );
    patch.body = t;
  }
  if (typeof body.badge === "string") patch.badge = body.badge.trim() || null;
  if (typeof body.archived === "boolean") patch.archived = body.archived;
  if (typeof body.publishedAt === "string" && body.publishedAt.trim()) {
    const d = new Date(body.publishedAt);
    if (!Number.isNaN(d.getTime())) patch.publishedAt = d;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "Нет полей для обновления" },
      { status: 400 }
    );
  }

  const [row] = await db
    .update(news)
    .set(patch)
    .where(eq(news.id, newsId))
    .returning(NEWS_FIELDS);

  if (!row) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  return NextResponse.json({ news: row });
}

/** Удаление новости. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const newsId = Number(id);
  if (!Number.isFinite(newsId)) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  await db.delete(news).where(eq(news.id, newsId));
  return NextResponse.json({ ok: true });
}
