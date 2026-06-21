import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AutomarkiClient, { type CarBrand } from "./AutomarkiClient";

export const metadata = {
  title: "Автомарки — подбор запчастей по марке авто | Brocar",
  description:
    "Выберите марку автомобиля и подберите подходящие запчасти: BMW, Toyota, Kia и десятки других марок.",
};

// Базовый URL для серверного fetch к собственному API (внутри контейнера Next
// слушает 127.0.0.1:3000). Тот же приём, что в app/catalog/page.tsx.
const INTERNAL_BASE = process.env.INTERNAL_API_BASE || "http://127.0.0.1:3000";

/**
 * Страница автомарок. Список марок подгружается НА СЕРВЕРЕ и отдаётся прямо в HTML —
 * у пользователя нет клиентского водопада «спиннер → fetch → рендер», сетка видна
 * сразу (и её видят поисковики). Кэш у /api/catalog/car-brands агрессивный
 * (s-maxage=86400), плюс Next Data Cache (revalidate) — cold-цену почти никто не платит.
 */
export default async function AutomarkiPage() {
  let initialBrands: CarBrand[] = [];
  try {
    const res = await fetch(`${INTERNAL_BASE}/api/catalog/car-brands`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = await res.json();
      initialBrands = Array.isArray(data.brands) ? data.brands : [];
    }
  } catch {
    // Сервер не смог подгрузить — отдаём пустой список, клиент покажет «Пока нет марок».
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="container mx-auto px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center text-orange-500 hover:text-orange-400 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Вернуться на главную
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            Автомарки
          </h1>
          <p className="text-neutral-400">
            Выберите марку автомобиля — покажем все подходящие запчасти
          </p>
        </div>

        <AutomarkiClient initialBrands={initialBrands} />
      </div>
    </div>
  );
}
