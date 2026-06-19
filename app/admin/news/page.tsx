import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { news } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import AdminNewsManager, {
  type AdminNews,
} from "@/components/admin/AdminNewsManager";

export const dynamic = "force-dynamic";

export default async function AdminNewsPage() {
  const user = await getUser();
  if (!user) redirect("/auth/login");
  if (!isAdmin(user)) redirect("/dashboard");

  let initial: AdminNews[] = [];
  try {
    const rows = await db
      .select({
        id: news.id,
        title: news.title,
        body: news.body,
        badge: news.badge,
        archived: news.archived,
        publishedAt: news.publishedAt,
      })
      .from(news)
      .orderBy(desc(news.publishedAt), desc(news.id));
    initial = rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      badge: r.badge,
      archived: r.archived,
      publishedAt: r.publishedAt.toISOString(),
    }));
  } catch (e) {
    // Таблицы может ещё не быть — покажем пустой список.
    console.error("admin/news load error:", e);
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
          Новости
        </h1>
        <p className="text-neutral-400 mb-6 text-sm leading-relaxed">
          Пиши короткие новости — на главной показываются 6 свежих из раздела «На
          сайте». Кнопка «В архив» 🗄 убирает новость с сайта, но сохраняет её
          (раздел «Архив»): оттуда можно вернуть ↩ или удалить насовсем. Метка
          (необязательно) — цветной ярлык вроде «Акция» или «Режим работы».
        </p>
        <AdminNewsManager initialNews={initial} />
      </div>
    </div>
  );
}
