import { Megaphone, CalendarDays } from "lucide-react";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { news } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

// Серверный компонент: новости приходят в HTML, без supabase-js в клиентском
// бандле главной и без клиентского fetch-водопада. Кэшируем на 5 минут
// (revalidate) — новости почти статичны, в БД лезем редко.
const getNews = unstable_cache(
  async () =>
    db
      .select({
        id: news.id,
        title: news.title,
        body: news.body,
        badge: news.badge,
        publishedAt: news.publishedAt,
      })
      .from(news)
      .where(eq(news.archived, false))
      .orderBy(desc(news.publishedAt))
      .limit(6),
  ["homepage-news"],
  { revalidate: 300, tags: ["news"] }
);

// d может прийти как Date (cache miss) или как строка (после сериализации в
// unstable_cache) — приводим к Date, иначе .toLocaleDateString() падает на строке.
function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function NewsSection() {
  let items: Awaited<ReturnType<typeof getNews>> = [];
  try {
    items = await getNews();
  } catch {
    return null; // БД недоступна — секцию просто не показываем
  }

  if (items.length === 0) return null;

  return (
    <section className="py-10 md:py-16 border-t border-neutral-800/50">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-3 mb-6 md:mb-8">
          <div className="w-9 h-9 bg-orange-500/20 rounded-xl flex items-center justify-center shrink-0">
            <Megaphone className="h-4 w-4 text-orange-500" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white">Новости</h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-neutral-900 border border-neutral-800 hover:border-orange-500/40 transition-colors rounded-2xl p-5"
            >
              <div className="flex items-center gap-2 text-neutral-500 text-xs mb-3">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                <span>{formatDate(item.publishedAt)}</span>
                {item.badge && (
                  <span className="ml-auto bg-orange-500/10 text-orange-400 text-[11px] font-medium px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </div>
              <p className="font-semibold text-white text-sm mb-2">{item.title}</p>
              <p className="text-neutral-400 text-sm leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
