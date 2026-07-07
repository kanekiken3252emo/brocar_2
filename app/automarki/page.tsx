import AutomarkiClient, { type CarBrand } from "./AutomarkiClient";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const metadata = {
  // « | BroCar» допишет шаблон лейаута — бренд вручную не дублируем.
  title: "Запчасти по маркам авто — купить в Екатеринбурге",
  description:
    "Подбор запчастей по марке автомобиля: Toyota, Kia, Hyundai, BMW, Lada и десятки других. 180 000+ деталей в наличии, доставка по России. Выбирайте марку!",
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
    // Таймаут обязателен: зависший API (пул БД) не должен вешать SSR страницы
    // на минуты — при истечении отдаём пустой список, клиент покажет заглушку.
    const res = await fetch(`${INTERNAL_BASE}/api/catalog/car-brands`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
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
        <div className="mb-6">
          <Breadcrumbs
            items={[
              { name: "Главная", href: "/" },
              { name: "Автомарки", href: "/automarki" },
            ]}
          />
        </div>

        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            Запчасти по маркам автомобилей
          </h1>
          <p className="text-neutral-400">
            Выберите марку — покажем все подходящие запчасти в наличии в
            Екатеринбурге и с доставкой по России
          </p>
        </div>

        <AutomarkiClient initialBrands={initialBrands} />
      </div>
    </div>
  );
}
