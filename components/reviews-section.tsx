import { Star } from "lucide-react";

/**
 * Виджет отзывов из Яндекс.Бизнес.
 *
 * Как получить ID организации:
 *  1. Зайдите на https://yandex.ru/sprav (Яндекс Бизнес) под аккаунтом компании.
 *  2. Выберите организацию → раздел «Виджеты» → «Отзывы и рейтинг».
 *  3. В сгенерированном коде будет ссылка вида
 *       https://yandex.ru/maps-reviews-widget/НОМЕР?comments
 *     и ссылка на карточку
 *       https://yandex.ru/maps/org/.../НОМЕР/
 *     Скопируйте этот НОМЕР (ID организации) сюда.
 *
 * Пока ID не указан — секция не отображается (return null ниже).
 */
const YANDEX_ORG_ID = "35950776894"; // BroCar (Брокар) на Яндекс.Картах

export function ReviewsSection() {
  // Если ID ещё не вставлен — ничего не рендерим, чтобы не сломать главную.
  if (!YANDEX_ORG_ID) return null;

  return (
    <section className="py-10 md:py-16 border-t border-neutral-800/50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center gap-3 mb-6 md:mb-8">
          <div className="w-9 h-9 bg-orange-500/20 rounded-xl flex items-center justify-center shrink-0">
            <Star className="h-4 w-4 text-orange-500" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            Что говорят о нас
          </h2>
        </div>

        {/* Контейнер для iframe Яндекса. Сам виджет имеет светлую тему и
            корректно рендерится только при ширине 300–760px (шире — Яндекс
            оставляет пустую полосу справа), поэтому ограничиваем ширину и
            центрируем. */}
        <div className="mx-auto w-full max-w-[760px] overflow-hidden rounded-2xl border border-neutral-800 bg-white">
          <iframe
            title="Отзывы о BroCar на Яндексе"
            src={`https://yandex.ru/maps-reviews-widget/${YANDEX_ORG_ID}?comments`}
            className="w-full"
            style={{ height: 600, border: "none" }}
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
}
