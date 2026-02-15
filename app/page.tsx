"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ChevronRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import BrandCatalogHero from "@/components/BrandCatalogHero";

const FEATURES = [
  {
    img: "/garantiya-kachestva.png",
    title: "Гарантия качества",
    description: "Все запчасти сертифицированы и имеют гарантию производителя",
  },
  {
    img: "/bistraya-dostavka.png",
    title: "Быстрая доставка",
    description: "Отправляем заказы в день оформления по всей России",
  },
  {
    img: "/bistroe-oformlenit.png",
    title: "Быстрое оформление",
    description: "Наши специалисты всегда готовы помочь с подбором",
  },
  {
    img: "/fast-poisk.png",
    title: "Моментальный поиск",
    description: "Работаем напрямую с поставщиками без посредников",
  },
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

      {/* Visual Catalog Grid */}
      <section className="py-10 md:py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8 md:mb-14">
            <h2 className="text-2xl md:text-4xl font-bold text-white mb-2 md:mb-4">
              Каталог запчастей
            </h2>
            <p className="text-neutral-400 text-sm md:text-lg max-w-2xl mx-auto">
              Запчасти для ТО, ремонта и обслуживания автомобиля
            </p>
          </div>

          {/* Row 1 — Two large hero cards */}
          <div className="grid md:grid-cols-2 gap-4 md:gap-5 mb-4 md:mb-5">
            <Link href="/catalog?type=original" className="group">
              <div className="relative overflow-hidden rounded-2xl md:rounded-3xl h-[200px] md:h-[280px] bg-gradient-to-br from-teal-600 to-teal-800 flex items-center">
                <div className="relative z-10 p-6 md:p-10 flex-1">
                  <h3 className="text-xl md:text-3xl font-bold text-white mb-1 md:mb-2">
                    Оригинальные запчасти
                  </h3>
                  <p className="text-white/70 text-sm md:text-base mb-3">
                    Поиск по марке автомобиля
                  </p>
                  <span className="inline-flex items-center gap-2 text-white font-semibold text-sm md:text-base bg-white/20 px-4 py-2 rounded-lg group-hover:bg-white/30 transition-colors">
                    Перейти <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
                <div className="relative w-1/2 h-full flex items-center justify-center p-4">
                  <Image
                    src="/motor.png"
                    alt="Двигатель"
                    width={400}
                    height={400}
                    className="w-full h-full object-contain drop-shadow-2xl group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              </div>
            </Link>

            <Link href="/catalog" className="group">
              <div className="relative overflow-hidden rounded-2xl md:rounded-3xl h-[200px] md:h-[280px] bg-neutral-100 flex items-center">
                <div className="relative z-10 p-6 md:p-10 flex-1">
                  <h3 className="text-xl md:text-3xl font-bold text-neutral-900 mb-1 md:mb-2">
                    Общий каталог
                  </h3>
                  <p className="text-neutral-500 text-sm md:text-base mb-3">
                    Более 1 000 000 запчастей
                  </p>
                  <span className="inline-flex items-center gap-2 text-orange-600 font-semibold text-sm md:text-base">
                    Перейти <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
                <div className="relative w-1/2 h-full flex items-center justify-center p-6">
                  <Image
                    src="/masl-filtr.png"
                    alt="Фильтры"
                    width={300}
                    height={300}
                    className="w-full h-full object-contain drop-shadow-lg group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              </div>
            </Link>
          </div>

          {/* Row 2 — Three medium cards + sidebar links */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 mb-4 md:mb-5">
            <Link href="/catalog?category=brake-fluids" className="group">
              <div className="relative overflow-hidden rounded-2xl h-[180px] md:h-[250px] bg-neutral-100 flex flex-col items-center justify-center p-4">
                <div className="flex-1 flex items-center justify-center">
                  <Image
                    src="/tormoz-zhidkost.png"
                    alt="Тормозные жидкости"
                    width={200}
                    height={200}
                    className="h-24 md:h-40 w-auto object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <h3 className="text-sm md:text-base font-semibold text-neutral-800 text-center mt-2">
                  Тормозные жидкости
                </h3>
              </div>
            </Link>

            <Link href="/catalog?category=engine-oils" className="group md:col-span-2">
              <div className="relative overflow-hidden rounded-2xl h-[180px] md:h-[250px] bg-gradient-to-br from-amber-50 to-orange-50 flex items-center px-4 md:px-8">
                <div className="flex-1 flex items-center justify-center">
                  <Image
                    src="/motornie-masla.png"
                    alt="Моторные масла"
                    width={400}
                    height={300}
                    className="h-28 md:h-44 w-auto object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-lg md:text-2xl font-bold text-neutral-800 mb-1">
                    Моторные масла
                  </h3>
                  <p className="text-neutral-500 text-xs md:text-sm">Castrol, Toyota, Shell, Mobil</p>
                </div>
              </div>
            </Link>

            {/* Sidebar links */}
            <div className="col-span-2 md:col-span-1 bg-neutral-900 border border-neutral-800 rounded-2xl p-4 md:p-5 flex flex-col justify-center gap-3">
              {[
                { name: "Трансмиссионные масла", href: "/catalog?category=transmission-oils" },
                { name: "Автокосметика", href: "/catalog?category=cosmetics" },
                { name: "Охлаждающие жидкости", href: "/catalog?category=coolants" },
                { name: "Омыватель стекла", href: "/catalog?category=washer-fluid" },
                { name: "Вся автохимия", href: "/catalog?category=chemicals" },
              ].map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="text-sm md:text-base text-neutral-300 hover:text-orange-500 transition-colors flex items-center justify-between group"
                >
                  {link.name}
                  <ChevronRight className="h-4 w-4 text-neutral-600 group-hover:text-orange-500 transition-colors" />
                </Link>
              ))}
            </div>
          </div>

          {/* Row 3 — Accessories + sidebar + Tires & Wheels */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 mb-4 md:mb-5">
            <Link href="/catalog?category=accessories" className="group md:col-span-1">
              <div className="relative overflow-hidden rounded-2xl h-[180px] md:h-[250px] bg-gradient-to-br from-violet-600 to-purple-800 flex flex-col items-center justify-center p-4">
                <div className="flex-1 flex items-center justify-center">
                  <Image
                    src="/autobox-top.png"
                    alt="Аксессуары"
                    width={300}
                    height={200}
                    className="h-20 md:h-32 w-auto object-contain drop-shadow-lg group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <h3 className="text-sm md:text-lg font-bold text-white text-center mt-2">
                  Аксессуары
                </h3>
              </div>
            </Link>

            {/* Sidebar links */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 md:p-5 flex flex-col justify-center gap-3">
              {[
                { name: "Все для ремонта", href: "/catalog?category=repair" },
                { name: "Автолитература", href: "/catalog?category=books" },
                { name: "Инструмент", href: "/catalog?category=tools", isNew: true },
                { name: "Все принадлежности", href: "/catalog?category=all-accessories" },
              ].map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="text-sm md:text-base text-neutral-300 hover:text-orange-500 transition-colors flex items-center justify-between group"
                >
                  <span className="flex items-center gap-2">
                    {link.name}
                    {link.isNew && (
                      <span className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">Новое</span>
                    )}
                  </span>
                  <ChevronRight className="h-4 w-4 text-neutral-600 group-hover:text-orange-500 transition-colors" />
                </Link>
              ))}
            </div>

            <Link href="/catalog?category=tires" className="group">
              <div className="relative overflow-hidden rounded-2xl h-[180px] md:h-[250px] bg-neutral-100 flex flex-col items-center justify-center p-4">
                <div className="flex-1 flex items-center justify-center">
                  <Image
                    src="/shina-png1.png"
                    alt="Шины"
                    width={250}
                    height={250}
                    className="h-24 md:h-36 w-auto object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <h3 className="text-sm md:text-lg font-bold text-neutral-800 text-center mt-2">Шины</h3>
              </div>
            </Link>

            <Link href="/catalog?category=wheels" className="group">
              <div className="relative overflow-hidden rounded-2xl h-[180px] md:h-[250px] bg-neutral-100 flex flex-col items-center justify-center p-4">
                <div className="flex-1 flex items-center justify-center">
                  <Image
                    src="/litoi-disk.png"
                    alt="Диски"
                    width={250}
                    height={250}
                    className="h-24 md:h-36 w-auto object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <h3 className="text-sm md:text-lg font-bold text-neutral-800 text-center mt-2">Диски</h3>
              </div>
            </Link>
          </div>

          {/* Row 4 — Brake system + Lamps + Battery + Antifreeze */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
            <Link href="/catalog?category=brake-pads" className="group md:col-span-2">
              <div className="relative overflow-hidden rounded-2xl h-[180px] md:h-[220px] bg-neutral-100 flex items-center px-4 md:px-8">
                <div className="flex-1 flex items-center justify-center">
                  <Image
                    src="/kolodki-i-disk.png"
                    alt="Тормозная система"
                    width={350}
                    height={250}
                    className="h-28 md:h-40 w-auto object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-lg md:text-2xl font-bold text-neutral-800 mb-1">
                    Тормозная система
                  </h3>
                  <p className="text-neutral-500 text-xs md:text-sm">Диски, колодки, суппорты</p>
                </div>
              </div>
            </Link>

            <Link href="/catalog?category=lighting" className="group">
              <div className="relative overflow-hidden rounded-2xl h-[180px] md:h-[220px] bg-neutral-100 flex flex-col items-center justify-center p-4">
                <div className="flex-1 flex items-center justify-center">
                  <Image
                    src="/lampa-h7.png"
                    alt="Лампы"
                    width={200}
                    height={200}
                    className="h-20 md:h-32 w-auto object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <h3 className="text-sm md:text-base font-semibold text-neutral-800 text-center mt-2">Лампы</h3>
              </div>
            </Link>

            <Link href="/catalog?category=batteries" className="group">
              <div className="relative overflow-hidden rounded-2xl h-[180px] md:h-[220px] bg-gradient-to-br from-rose-400 to-rose-500 flex flex-col items-center justify-center p-4">
                <div className="flex-1 flex items-center justify-center">
                  <Image
                    src="/akkumulyatorr1.png"
                    alt="Аккумуляторы"
                    width={200}
                    height={200}
                    className="h-20 md:h-32 w-auto object-contain drop-shadow-lg group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <h3 className="text-sm md:text-base font-bold text-white text-center mt-2">Аккумуляторы</h3>
              </div>
            </Link>
          </div>

          {/* Row 5 — Antifreeze standalone */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 mt-4 md:mt-5">
            <Link href="/catalog?category=coolants" className="group">
              <div className="relative overflow-hidden rounded-2xl h-[180px] md:h-[220px] bg-gradient-to-br from-cyan-50 to-sky-100 flex flex-col items-center justify-center p-4">
                <div className="flex-1 flex items-center justify-center">
                  <Image
                    src="/antifreeze-kanistra.png"
                    alt="Охлаждающие жидкости"
                    width={200}
                    height={200}
                    className="h-24 md:h-36 w-auto object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <h3 className="text-xs md:text-base font-semibold text-neutral-800 text-center mt-2">Охлаждающие жидкости</h3>
              </div>
            </Link>

            <Link href="/catalog" className="group md:col-span-3">
              <div className="relative overflow-hidden rounded-2xl h-[180px] md:h-[220px] bg-gradient-to-r from-orange-500 to-orange-700 flex items-center px-6 md:px-12">
                <div className="relative z-10 flex-1">
                  <h3 className="text-xl md:text-3xl font-bold text-white mb-1 md:mb-2">
                    Не нашли нужную запчасть?
                  </h3>
                  <p className="text-white/80 text-sm md:text-base mb-3">
                    Поиск по VIN-коду или артикулу
                  </p>
                  <span className="inline-flex items-center gap-2 text-white font-semibold text-sm md:text-base bg-white/20 px-4 py-2 rounded-lg group-hover:bg-white/30 transition-colors">
                    Перейти в каталог <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
              </div>
            </Link>
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
            {FEATURES.map((feature) => (
              <div 
                key={feature.title}
                className="bg-neutral-900 border border-neutral-800 rounded-xl md:rounded-2xl p-4 md:p-6 hover:border-orange-500/50 transition-all duration-300"
              >
                <div className="w-10 h-10 md:w-12 md:h-12 mb-3 md:mb-4">
                  <Image
                    src={feature.img}
                    alt={feature.title}
                    width={48}
                    height={48}
                    className="w-full h-full object-contain"
                  />
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
