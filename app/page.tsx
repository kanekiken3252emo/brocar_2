"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import BrandCatalogHero from "@/components/BrandCatalogHero";

export default function HomePage() {
  return (
    <div className="bg-[#f5f5f5] min-h-screen">
      <div className="container mx-auto px-4 py-8">
        {/* Brand Catalog - Like exist.ru */}
        <div className="mb-8">
          <BrandCatalogHero />
        </div>

        {/* Main Content with Sidebar */}
        <div className="flex gap-6">
          {/* Main Content */}
          <div className="flex-1">
            {/* Large Hero Cards - Original & General Catalog */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Original Catalogs */}
              <Link href="/catalog?type=original">
                <Card className="overflow-hidden hover:shadow-xl transition-all cursor-pointer h-[200px] group">
                  <div className="h-full bg-gradient-to-br from-teal-400 to-teal-500 relative flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-5 transition-opacity" />
                    <div className="text-center text-white z-10">
                      <div className="text-6xl mb-3">🔧</div>
                      <h2 className="text-2xl font-bold">Оригинальные каталоги</h2>
                    </div>
                  </div>
                </Card>
              </Link>

              {/* General Catalog */}
              <Link href="/catalog">
                <Card className="overflow-hidden hover:shadow-xl transition-all cursor-pointer h-[200px] group">
                  <div className="h-full bg-white relative flex items-center justify-center p-6 border-2 border-gray-200">
                    <div className="absolute inset-0 bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="text-center z-10">
                      <div className="text-6xl mb-3">🛒</div>
                      <h2 className="text-2xl font-bold text-gray-800">Общий каталог</h2>
                    </div>
                  </div>
                </Card>
              </Link>
            </div>

            {/* Service Parts Section */}
            <div className="bg-white rounded-lg shadow-md mb-8">
              <div className="border-b border-gray-200 px-6 py-4">
                <h3 className="text-lg font-bold text-gray-800">
                  Запчасти для технического обслуживания
                </h3>
              </div>
              
              <div className="p-6 grid md:grid-cols-4 gap-4">
                {/* Brake Fluids */}
                <Link href="/catalog?category=brake-fluids">
                  <Card className="overflow-hidden hover:shadow-lg transition-all cursor-pointer border border-gray-200">
                    <div className="h-32 bg-gradient-to-br from-yellow-300 to-yellow-400 flex items-center justify-center">
                      <div className="text-5xl">🧴</div>
                    </div>
                    <div className="p-3 bg-white text-center">
                      <h4 className="font-semibold text-sm">Тормозные жидкости</h4>
                    </div>
                  </Card>
                </Link>

                {/* Engine Oils */}
                <Link href="/catalog?category=engine-oils">
                  <Card className="overflow-hidden hover:shadow-lg transition-all cursor-pointer border border-gray-200">
                    <div className="h-32 bg-gradient-to-br from-orange-300 to-orange-400 flex items-center justify-center">
                      <div className="text-5xl">🛢️</div>
                    </div>
                    <div className="p-3 bg-white text-center">
                      <h4 className="font-semibold text-sm">Моторные масла</h4>
                    </div>
                  </Card>
                </Link>

                {/* Filters */}
                <Link href="/catalog?category=filters">
                  <Card className="overflow-hidden hover:shadow-lg transition-all cursor-pointer border border-gray-200">
                    <div className="h-32 bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center">
                      <div className="text-5xl">🔄</div>
                    </div>
                    <div className="p-3 bg-white text-center">
                      <h4 className="font-semibold text-sm">Фильтры</h4>
                    </div>
                  </Card>
                </Link>

                {/* Brake Pads */}
                <Link href="/catalog?category=brake-pads">
                  <Card className="overflow-hidden hover:shadow-lg transition-all cursor-pointer border border-gray-200">
                    <div className="h-32 bg-gradient-to-br from-red-400 to-red-500 flex items-center justify-center">
                      <div className="text-5xl">🛑</div>
                    </div>
                    <div className="p-3 bg-white text-center">
                      <h4 className="font-semibold text-sm">Тормозные колодки</h4>
                    </div>
                  </Card>
                </Link>

                {/* Spark Plugs */}
                <Link href="/catalog?category=spark-plugs">
                  <Card className="overflow-hidden hover:shadow-lg transition-all cursor-pointer border border-gray-200">
                    <div className="h-32 bg-gradient-to-br from-purple-400 to-purple-500 flex items-center justify-center">
                      <div className="text-5xl">⚡</div>
                    </div>
                    <div className="p-3 bg-white text-center">
                      <h4 className="font-semibold text-sm">Свечи зажигания</h4>
                    </div>
                  </Card>
                </Link>

                {/* Timing Belts */}
                <Link href="/catalog?category=timing-belts">
                  <Card className="overflow-hidden hover:shadow-lg transition-all cursor-pointer border border-gray-200">
                    <div className="h-32 bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center">
                      <div className="text-5xl">🔗</div>
                    </div>
                    <div className="p-3 bg-white text-center">
                      <h4 className="font-semibold text-sm">Ремни ГРМ</h4>
                    </div>
                  </Card>
                </Link>
              </div>
            </div>

            {/* Fluids and Oils Section */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              {/* Brake Fluids */}
              <Link href="/catalog?category=brake-fluids-full">
                <Card className="overflow-hidden hover:shadow-xl transition-all cursor-pointer h-[220px]">
                  <div className="h-full bg-gradient-to-br from-yellow-100 to-yellow-200 relative flex items-center justify-center p-6">
                    <div className="text-center">
                      <div className="text-7xl mb-3">🧴</div>
                      <h3 className="text-xl font-bold text-gray-800">Тормозные жидкости</h3>
                    </div>
                  </div>
                </Card>
              </Link>

              {/* Motor Oils */}
              <Link href="/catalog?category=motor-oils-full">
                <Card className="overflow-hidden hover:shadow-xl transition-all cursor-pointer h-[220px]">
                  <div className="h-full bg-gradient-to-br from-amber-200 to-amber-300 relative flex items-center justify-center p-6">
                    <div className="text-center">
                      <div className="text-7xl mb-3">🛢️</div>
                      <h3 className="text-xl font-bold text-gray-800">Моторные масла</h3>
                    </div>
                  </div>
                </Card>
              </Link>
            </div>

            {/* Additional Categories Section */}
            <div className="bg-white rounded-lg shadow-md mb-8">
              <div className="border-b border-gray-200 px-6 py-4">
                <h3 className="text-lg font-bold text-gray-800">
                  Подвеска и освещение
                </h3>
              </div>
              
              <div className="p-6 grid md:grid-cols-3 gap-6">
                {/* Suspension */}
                <Link href="/catalog?category=suspension">
                  <Card className="overflow-hidden hover:shadow-lg transition-all cursor-pointer border border-gray-200">
                    <div className="h-40 bg-gradient-to-br from-indigo-400 to-indigo-500 flex items-center justify-center">
                      <div className="text-6xl">🔧</div>
                    </div>
                    <div className="p-4 bg-white text-center">
                      <h4 className="font-semibold">Подвеска</h4>
                      <p className="text-xs text-gray-500 mt-1">
                        Sachs, Monroe, Bilstein
                      </p>
                    </div>
                  </Card>
                </Link>

                {/* Lighting */}
                <Link href="/catalog?category=lighting">
                  <Card className="overflow-hidden hover:shadow-lg transition-all cursor-pointer border border-gray-200">
                    <div className="h-40 bg-gradient-to-br from-amber-300 to-amber-400 flex items-center justify-center">
                      <div className="text-6xl">💡</div>
                    </div>
                    <div className="p-4 bg-white text-center">
                      <h4 className="font-semibold">Освещение</h4>
                      <p className="text-xs text-gray-500 mt-1">
                        Hella, Osram, Philips
                      </p>
                    </div>
                  </Card>
                </Link>
              </div>
            </div>

            {/* Accessories Section */}
            <div className="bg-white rounded-lg shadow-md mb-8">
              <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-800">
                  Аксессуары и дополнительное оборудование
                </h3>
              </div>
              
              <div className="p-6 grid md:grid-cols-4 gap-4">
                {/* Child Seats */}
                <Link href="/catalog?category=child-seats">
                  <Card className="overflow-hidden hover:shadow-lg transition-all cursor-pointer border border-gray-200">
                    <div className="h-32 bg-gradient-to-br from-purple-300 to-purple-400 flex items-center justify-center">
                      <div className="text-5xl">👶</div>
                    </div>
                    <div className="p-3 bg-white text-center">
                      <h4 className="font-semibold text-sm">Детские автокресла</h4>
                    </div>
                  </Card>
                </Link>

                {/* Tools */}
                <Link href="/catalog?category=tools">
                  <Card className="overflow-hidden hover:shadow-lg transition-all cursor-pointer border border-gray-200">
                    <div className="h-32 bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center">
                      <div className="text-5xl">🔨</div>
                    </div>
                    <div className="p-3 bg-white text-center">
                      <h4 className="font-semibold text-sm">Инструмент</h4>
                      <div className="inline-block mt-1 px-2 py-0.5 bg-red-500 text-white text-xs rounded">
                        Новое
                      </div>
                    </div>
                  </Card>
                </Link>

                {/* Car Literature */}
                <Link href="/catalog?category=car-books">
                  <Card className="overflow-hidden hover:shadow-lg transition-all cursor-pointer border border-gray-200">
                    <div className="h-32 bg-gradient-to-br from-blue-300 to-blue-400 flex items-center justify-center">
                      <div className="text-5xl">📚</div>
                    </div>
                    <div className="p-3 bg-white text-center">
                      <h4 className="font-semibold text-sm">Автолитература</h4>
                    </div>
                  </Card>
                </Link>

                {/* All Accessories */}
                <Link href="/catalog?category=accessories">
                  <Card className="overflow-hidden hover:shadow-lg transition-all cursor-pointer border border-gray-200">
                    <div className="h-32 bg-gradient-to-br from-pink-300 to-pink-400 flex items-center justify-center">
                      <div className="text-5xl">🎁</div>
                    </div>
                    <div className="p-3 bg-white text-center">
                      <h4 className="font-semibold text-sm">Все принадлежности</h4>
                    </div>
                  </Card>
                </Link>
              </div>
            </div>

            {/* Tires Section */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Tires */}
              <Link href="/catalog?category=tires">
                <Card className="overflow-hidden hover:shadow-xl transition-all cursor-pointer h-[180px]">
                  <div className="h-full bg-gradient-to-br from-slate-700 to-slate-800 relative flex items-center justify-center p-6">
                    <div className="text-center text-white">
                      <div className="text-6xl mb-3">🛞</div>
                      <h3 className="text-2xl font-bold">Шины</h3>
                    </div>
                  </div>
                </Card>
              </Link>

              {/* Wheels/Discs */}
              <Link href="/catalog?category=wheels">
                <Card className="overflow-hidden hover:shadow-xl transition-all cursor-pointer h-[180px]">
                  <div className="h-full bg-gradient-to-br from-slate-600 to-slate-700 relative flex items-center justify-center p-6">
                    <div className="text-center text-white">
                      <div className="text-6xl mb-3">⚙️</div>
                      <h3 className="text-2xl font-bold">Диски</h3>
                    </div>
                  </div>
                </Card>
              </Link>
            </div>
          </div>

          {/* Right Sidebar */}
          <aside className="hidden lg:block w-64 shrink-0 space-y-6">
            {/* Info Card */}
            <Card className="bg-orange-50 border-orange-200">
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">
                  Информация
                </h3>
                <ul className="space-y-3">
                  <li>
                    <Link href="/order-payment" className="text-sm text-blue-600 hover:underline block">
                      Оплата заказа
                    </Link>
                  </li>
                  <li>
                    <Link href="/delivery" className="text-sm text-blue-600 hover:underline block">
                      Доставка и выхлоп
                    </Link>
                  </li>
                  <li>
                    <Link href="/wipers" className="text-sm text-blue-600 hover:underline block">
                      Щётки стеклоочистителя
                    </Link>
                  </li>
                  <li>
                    <Link href="/moto-catalog" className="text-sm text-blue-600 hover:underline block">
                      Мотокаталоги
                    </Link>
                  </li>
                  <li>
                    <Link href="/catalog" className="text-sm text-blue-600 hover:underline block font-medium">
                      Все каталоги
                    </Link>
                  </li>
                </ul>
              </div>
            </Card>

            {/* Categories Card */}
            <Card className="bg-white border border-gray-200">
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">
                  Категории
                </h3>
                <ul className="space-y-2">
                  <li>
                    <Link href="/catalog?category=glass" className="text-sm text-gray-700 hover:text-blue-600 block">
                      Стекла
                    </Link>
                  </li>
                  <li>
                    <Link href="/catalog?category=suspension-exhaust" className="text-sm text-gray-700 hover:text-blue-600 block">
                      Подвеска и выхлоп
                    </Link>
                  </li>
                  <li>
                    <Link href="/catalog?category=wipers" className="text-sm text-gray-700 hover:text-blue-600 block">
                      Щётки стеклоочистителя
                    </Link>
                  </li>
                  <li>
                    <Link href="/catalog?category=moto" className="text-sm text-gray-700 hover:text-blue-600 block">
                      Мотокаталоги
                    </Link>
                  </li>
                  <li>
                    <Link href="/catalog?category=transmission-oils" className="text-sm text-gray-700 hover:text-blue-600 block">
                      Трансмиссионные масла
                    </Link>
                  </li>
                  <li>
                    <Link href="/catalog?category=cosmetics" className="text-sm text-gray-700 hover:text-blue-600 block">
                      Автокосметика
                    </Link>
                  </li>
                  <li>
                    <Link href="/catalog?category=coolant" className="text-sm text-gray-700 hover:text-blue-600 block">
                      Охлаждающие жидкости
                    </Link>
                  </li>
                  <li>
                    <Link href="/catalog?category=washer-fluid" className="text-sm text-gray-700 hover:text-blue-600 block">
                      Жидкости для омывателя стекла
                    </Link>
                  </li>
                  <li>
                    <Link href="/catalog?category=all-automotive" className="text-sm text-gray-700 hover:text-blue-600 block">
                      Вся автохимия
                    </Link>
                  </li>
                </ul>
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}

