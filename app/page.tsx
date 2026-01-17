"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Wrench, Shield, Truck, Clock, ChevronRight, Zap, Award, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import BrandCatalogHero from "@/components/BrandCatalogHero";

const CATEGORIES = [
  {
    title: "Моторные масла",
    icon: "🛢️",
    href: "/catalog?category=engine-oils",
    gradient: "from-orange-500 to-red-600",
  },
  {
    title: "Тормозные колодки",
    icon: "🛑",
    href: "/catalog?category=brake-pads",
    gradient: "from-red-500 to-pink-600",
  },
  {
    title: "Фильтры",
    icon: "🔄",
    href: "/catalog?category=filters",
    gradient: "from-blue-500 to-cyan-600",
  },
  {
    title: "Свечи зажигания",
    icon: "⚡",
    href: "/catalog?category=spark-plugs",
    gradient: "from-yellow-500 to-orange-600",
  },
  {
    title: "Ремни ГРМ",
    icon: "🔗",
    href: "/catalog?category=timing-belts",
    gradient: "from-green-500 to-emerald-600",
  },
  {
    title: "Подвеска",
    icon: "🔧",
    href: "/catalog?category=suspension",
    gradient: "from-purple-500 to-violet-600",
  },
];

const FEATURES = [
  {
    icon: Shield,
    title: "Гарантия качества",
    description: "Все запчасти сертифицированы и имеют гарантию производителя",
  },
  {
    icon: Truck,
    title: "Быстрая доставка",
    description: "Отправляем заказы в день оформления по всей России",
  },
  {
    icon: Clock,
    title: "Поддержка 24/7",
    description: "Наши специалисты всегда готовы помочь с подбором",
  },
  {
    icon: Zap,
    title: "Лучшие цены",
    description: "Работаем напрямую с поставщиками без посредников",
  },
];

const POPULAR_BRANDS = [
  "Bosch", "Mann-Filter", "NGK", "Brembo", "Sachs", "Lemforder", 
  "SKF", "Gates", "Continental", "Mahle", "Hella", "Valeo"
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-600/20 via-neutral-950 to-neutral-950" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-orange-500/10 to-transparent" />
        
        {/* Decorative Elements - hidden on small screens for performance */}
        <div className="absolute top-20 right-20 w-72 h-72 bg-orange-500/20 rounded-full blur-3xl hidden md:block" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl hidden md:block" />
        
        <div className="container mx-auto px-4 py-10 md:py-20 relative z-10">
          <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-20">
            {/* Text Content */}
            <div className="flex-1 max-w-2xl text-center lg:text-left order-2 lg:order-1">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-orange-500/10 border border-orange-500/30 rounded-full text-orange-400 text-xs md:text-sm mb-4 md:mb-6">
                <Zap className="h-3 w-3 md:h-4 md:w-4" />
                Более 1 000 000 запчастей в наличии
              </div>
              
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold text-white mb-4 md:mb-6 leading-tight">
                Качественные
                <br />
                <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                  автозапчасти
                </span>
                <br />
                для вашего авто
              </h1>
              
              <p className="text-base md:text-xl text-neutral-400 mb-6 md:mb-8 px-2 md:px-0">
                Профессиональный поставщик автозапчастей. Поиск по VIN, артикулу или марке автомобиля. Быстрая доставка по всей России.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center lg:justify-start px-4 sm:px-0">
                <Link href="/catalog" className="w-full sm:w-auto">
                  <Button size="lg" className="group w-full sm:w-auto">
                    Перейти в каталог
                    <ArrowRight className="h-4 w-4 md:h-5 md:w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link href="/vin-search" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    Поиск по VIN
                  </Button>
                </Link>
              </div>
            </div>
            
            {/* Logo - smaller on mobile, shown first */}
            <div className="relative flex-shrink-0 order-1 lg:order-2">
              <div className="relative w-40 h-40 sm:w-56 sm:h-56 md:w-72 md:h-72 lg:w-96 lg:h-96">
                {/* Glow effect behind logo */}
                <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-3xl scale-110" />
                <div className="absolute inset-4 bg-orange-500/10 rounded-full blur-2xl" />
                
                {/* Logo */}
                <Image
                  src="/logo.png"
                  alt="BroCar"
                  width={400}
                  height={400}
                  className="w-full h-full object-contain relative z-10 drop-shadow-2xl"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Brand Catalog Section */}
      <section className="py-8 md:py-12 border-y border-neutral-800/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h2 className="text-lg md:text-2xl font-bold text-white">Выберите марку</h2>
            <Link href="/catalog" className="text-orange-500 hover:text-orange-400 flex items-center gap-1 transition-colors text-sm md:text-base">
              Все марки <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <BrandCatalogHero />
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-10 md:py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-6 md:mb-12">
            <h2 className="text-2xl md:text-4xl font-bold text-white mb-2 md:mb-4">
              Популярные категории
            </h2>
            <p className="text-neutral-400 text-sm md:text-lg max-w-2xl mx-auto">
              Запчасти для ТО и ремонта
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
            {CATEGORIES.map((category) => (
              <Link key={category.title} href={category.href}>
                <div className="group relative bg-neutral-900 border border-neutral-800 rounded-xl md:rounded-2xl p-4 md:p-6 hover:border-orange-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/10 h-full">
                  <div className={`w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br ${category.gradient} rounded-lg md:rounded-xl flex items-center justify-center mb-3 md:mb-4 text-2xl md:text-3xl group-hover:scale-110 transition-transform`}>
                    {category.icon}
                  </div>
                  <h3 className="font-semibold text-white group-hover:text-orange-500 transition-colors text-sm md:text-base">
                    {category.title}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-10 md:py-20 bg-neutral-900/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-6 md:mb-12">
            <h2 className="text-2xl md:text-4xl font-bold text-white mb-2 md:mb-4">
              Почему выбирают нас
            </h2>
            <p className="text-neutral-400 text-sm md:text-lg max-w-2xl mx-auto">
              Более 10 лет на рынке автозапчастей
            </p>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
            {FEATURES.map((feature, index) => (
              <div 
                key={feature.title}
                className="bg-neutral-900 border border-neutral-800 rounded-xl md:rounded-2xl p-4 md:p-6 hover:border-orange-500/50 transition-all duration-300"
              >
                <div className="w-10 h-10 md:w-12 md:h-12 bg-orange-500/20 rounded-lg md:rounded-xl flex items-center justify-center mb-3 md:mb-4">
                  <feature.icon className="h-5 w-5 md:h-6 md:w-6 text-orange-500" />
                </div>
                <h3 className="text-sm md:text-lg font-semibold text-white mb-1 md:mb-2">
                  {feature.title}
                </h3>
                <p className="text-neutral-400 text-xs md:text-base hidden sm:block">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Large CTA Cards */}
      <section className="py-10 md:py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-4 md:gap-6">
            {/* Original Catalogs */}
            <Link href="/catalog?type=original">
              <div className="group relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-br from-orange-500 to-orange-700 p-6 md:p-12 h-[200px] md:h-[300px] flex flex-col justify-end cursor-pointer">
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                <div className="absolute top-4 right-4 md:top-8 md:right-8 opacity-30 group-hover:opacity-50 transition-opacity">
                  <Wrench className="h-16 w-16 md:h-32 md:w-32" />
                </div>
                <div className="relative z-10">
                  <h3 className="text-xl md:text-3xl font-bold text-white mb-1 md:mb-2">
                    Оригинальные каталоги
                  </h3>
                  <p className="text-white/80 mb-2 md:mb-4 text-sm md:text-base">
                    Подбор запчастей по каталогам производителей
                  </p>
                  <span className="inline-flex items-center gap-2 text-white font-semibold">
                    Перейти <ArrowRight className="h-5 w-5 group-hover:translate-x-2 transition-transform" />
                  </span>
                </div>
              </div>
            </Link>

            {/* General Catalog */}
            <Link href="/catalog">
              <div className="group relative overflow-hidden rounded-2xl md:rounded-3xl bg-neutral-800 border border-neutral-700 p-6 md:p-12 h-[200px] md:h-[300px] flex flex-col justify-end cursor-pointer hover:border-orange-500/50 transition-all">
                <div className="absolute top-4 right-4 md:top-8 md:right-8 opacity-20 group-hover:opacity-30 transition-opacity">
                  <Package className="h-16 w-16 md:h-32 md:w-32 text-orange-500" />
                </div>
                <div className="relative z-10">
                  <h3 className="text-xl md:text-3xl font-bold text-white mb-1 md:mb-2">
                    Общий каталог
                  </h3>
                  <p className="text-neutral-400 mb-2 md:mb-4 text-sm md:text-base">
                    Поиск по артикулу или названию
                  </p>
                  <span className="inline-flex items-center gap-2 text-orange-500 font-semibold text-sm md:text-base">
                    Перейти <ArrowRight className="h-4 w-4 md:h-5 md:w-5 group-hover:translate-x-2 transition-transform" />
                  </span>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Popular Brands */}
      <section className="py-10 md:py-20 border-t border-neutral-800/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-6 md:mb-12">
            <h2 className="text-2xl md:text-4xl font-bold text-white mb-2 md:mb-4">
              Популярные бренды
            </h2>
            <p className="text-neutral-400 text-sm md:text-lg max-w-2xl mx-auto">
              Работаем с проверенными производителями
            </p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-2 md:gap-4">
            {POPULAR_BRANDS.map((brand) => (
              <Link
                key={brand}
                href={`/catalog?brand=${encodeURIComponent(brand)}`}
                className="px-3 py-2 md:px-6 md:py-3 bg-neutral-900 border border-neutral-800 rounded-lg md:rounded-xl text-neutral-300 hover:border-orange-500/50 hover:text-orange-500 transition-all text-sm md:text-base"
              >
                {brand}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Additional Categories */}
      <section className="py-10 md:py-20 bg-neutral-900/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-6 md:mb-12">
            <h2 className="text-2xl md:text-4xl font-bold text-white mb-2 md:mb-4">
              Дополнительные категории
            </h2>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {[
              { title: "Шины", icon: "🛞", href: "/catalog?category=tires", desc: "Летние и зимние" },
              { title: "Диски", icon: "⚙️", href: "/catalog?category=wheels", desc: "Литые и штампованные" },
              { title: "Аккумуляторы", icon: "🔋", href: "/catalog?category=batteries", desc: "Все ёмкости" },
              { title: "Освещение", icon: "💡", href: "/catalog?category=lighting", desc: "Лампы и фары" },
            ].map((item) => (
              <Link key={item.title} href={item.href}>
                <div className="group bg-neutral-900 border border-neutral-800 rounded-xl md:rounded-2xl p-4 md:p-6 hover:border-orange-500/50 transition-all duration-300 h-full">
                  <div className="text-3xl md:text-5xl mb-2 md:mb-4">{item.icon}</div>
                  <h3 className="text-base md:text-xl font-semibold text-white mb-0.5 md:mb-1 group-hover:text-orange-500 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-neutral-500 text-xs md:text-sm">{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-10 md:py-20 border-t border-neutral-800/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 text-center">
            {[
              { value: "1M+", label: "Запчастей" },
              { value: "50+", label: "Поставщиков" },
              { value: "10K+", label: "Клиентов" },
              { value: "24/7", label: "Поддержка" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl sm:text-3xl md:text-5xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent mb-1 md:mb-2">
                  {stat.value}
                </div>
                <div className="text-neutral-400 text-xs md:text-base">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-10 md:py-20">
        <div className="container mx-auto px-4">
          <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-r from-orange-500 to-orange-700 p-6 md:p-16">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-orange-600/50 to-transparent" />
            
            <div className="relative z-10 max-w-2xl">
              <h2 className="text-xl md:text-4xl font-bold text-white mb-2 md:mb-4">
                Не нашли нужную запчасть?
              </h2>
              <p className="text-white/80 text-sm md:text-lg mb-4 md:mb-8">
                Оставьте заявку, и мы поможем подобрать нужную деталь по VIN-коду.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                <Link href="/vin-search" className="w-full sm:w-auto">
                  <Button size="lg" variant="secondary" className="!bg-white !text-orange-600 hover:!bg-neutral-100 !border-0 w-full sm:w-auto">
                    Запрос по VIN
                  </Button>
                </Link>
                <Link href="/contacts" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="!border-white !text-white hover:!bg-white/10 w-full sm:w-auto">
                    Связаться с нами
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
