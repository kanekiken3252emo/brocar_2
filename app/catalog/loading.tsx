/**
 * Мгновенный скелетон каталога. Next показывает его, пока серверный компонент
 * страницы (catalog/page.tsx) тянет данные категории/марки — вместо «зависшей»
 * старой страницы пользователь сразу видит каркас будущего грида.
 */
export default function CatalogLoading() {
  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="container mx-auto px-4 py-8">
        {/* Заголовок + «Найдено товаров» */}
        <div className="h-8 w-56 bg-neutral-800 rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-40 bg-neutral-900 rounded animate-pulse mb-6" />

        {/* Панель фильтров (производитель + сортировка) */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row gap-4">
          <div className="h-11 flex-1 bg-neutral-800 rounded-xl animate-pulse" />
          <div className="h-11 flex-1 bg-neutral-800 rounded-xl animate-pulse" />
        </div>

        {/* Сетка карточек-заглушек */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden"
            >
              <div className="h-40 bg-neutral-800 animate-pulse" />
              <div className="p-4 space-y-2.5">
                <div className="h-3 w-16 bg-neutral-800 rounded animate-pulse" />
                <div className="h-3 w-24 bg-neutral-800 rounded animate-pulse" />
                <div className="h-4 w-full bg-neutral-800 rounded animate-pulse" />
                <div className="h-6 w-20 bg-neutral-800 rounded animate-pulse mt-3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
