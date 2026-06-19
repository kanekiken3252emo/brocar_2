import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { news } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Поля, которые отдаём клиенту — совпадает с AdminNews.
const NEWS_FIELDS = {
  id: news.id,
  title: news.title,
  body: news.body,
  badge: news.badge,
  archived: news.archived,
  publishedAt: news.publishedAt,
} as const;

/** Список всех новостей для админки (свежие сверху). */
export async function GET() {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rows = await db
    .select(NEWS_FIELDS)
    .from(news)
    .orderBy(desc(news.publishedAt), desc(news.id));
  return NextResponse.json({ news: rows });
}

/** Создание новости. */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  const badge =
    typeof body.badge === "string" ? body.badge.trim() || null : null;

  if (!title || !text) {
    return NextResponse.json(
      { error: "Заполни заголовок и текст новости" },
      { status: 400 }
    );
  }

  // Дата публикации: либо переданная (datetime-local / ISO), либо сейчас.
  let publishedAt: Date | undefined;
  if (typeof body.publishedAt === "string" && body.publishedAt.trim()) {
    const d = new Date(body.publishedAt);
    if (!Number.isNaN(d.getTime())) publishedAt = d;
  }

  const [row] = await db
    .insert(news)
    .values({
      title,
      body: text,
      badge,
      ...(publishedAt ? { publishedAt } : {}),
    })
    .returning(NEWS_FIELDS);

  return NextResponse.json({ news: row });
}
