"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Megaphone, CalendarDays } from "lucide-react";

interface NewsItem {
  id: number;
  title: string;
  body: string;
  badge: string | null;
  published_at: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function NewsSection() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNews() {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("news")
          .select("id, title, body, badge, published_at")
          .order("published_at", { ascending: false })
          .limit(6);
        setNews(data ?? []);
      } catch {
        // Если БД недоступна — просто не показываем секцию
      } finally {
        setLoading(false);
      }
    }
    fetchNews();
  }, []);

  // Не рендерим секцию пока грузим и если новостей нет
  if (loading || news.length === 0) return null;

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
          {news.map((item) => (
            <div
              key={item.id}
              className="bg-neutral-900 border border-neutral-800 hover:border-orange-500/40 transition-colors rounded-2xl p-5"
            >
              <div className="flex items-center gap-2 text-neutral-500 text-xs mb-3">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                <span>{formatDate(item.published_at)}</span>
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
