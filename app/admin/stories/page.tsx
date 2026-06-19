import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { stories } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import AdminStoriesManager, {
  type AdminStory,
} from "@/components/admin/AdminStoriesManager";

export const dynamic = "force-dynamic";

export default async function AdminStoriesPage() {
  const user = await getUser();
  if (!user) redirect("/auth/login");
  if (!isAdmin(user)) redirect("/dashboard");

  let initial: AdminStory[] = [];
  try {
    const rows = await db
      .select()
      .from(stories)
      .orderBy(asc(stories.sortOrder), asc(stories.id));
    initial = rows.map((r) => ({
      id: r.id,
      title: r.title,
      mediaUrl: r.mediaUrl,
      mediaType: r.mediaType as "image" | "video",
      linkUrl: r.linkUrl,
      durationMs: r.durationMs,
      sortOrder: r.sortOrder,
      isActive: r.isActive,
    }));
  } catch (e) {
    // Таблицы может ещё не быть — покажем пустой список.
    console.error("admin/stories load error:", e);
    initial = [];
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-orange-400 transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          К заказам
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
          Истории
        </h1>
        <p className="text-neutral-400 mb-6 text-sm leading-relaxed">
          Загружай видео и фото — они показываются по кольцу на логотипе сайта
          (как сторис в ВК/Телеграм). Порядок задаётся стрелками, переключатель
          скрывает/показывает историю.
        </p>
        <AdminStoriesManager initialStories={initial} />
      </div>
    </div>
  );
}
