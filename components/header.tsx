"use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, User, Menu, ChevronDown, MapPin, Phone, Wrench, LogOut, Search, X } from "lucide-react";
import { Button } from "./ui/button";
import { useState } from "react";
import BrandCatalogDropdown from "./BrandCatalogDropdown";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface HeaderProps {
  user?: any;
}

const CATALOG_ITEMS = [
  {
    title: "Масла и автохимия",
    items: [
      { name: "Масла моторные", href: "/catalog?category=engine-oils" },
      { name: "Масла трансмиссионные", href: "/catalog?category=transmission-oils" },
      { name: "Жидкости для омывателя", href: "/catalog?category=washer-fluids" },
      { name: "Охлаждающие жидкости", href: "/catalog?category=coolants" },
    ],
  },
  {
    title: "Шины, диски",
    items: [
      { name: "Шины летние", href: "/catalog?category=summer-tires" },
      { name: "Шины зимние", href: "/catalog?category=winter-tires" },
      { name: "Диски колёсные", href: "/catalog?category=wheels" },
    ],
  },
  {
    title: "Автоэлектроника",
    items: [
      { name: "Лампы", href: "/catalog?category=lamps" },
      { name: "Аккумуляторы", href: "/catalog?category=batteries" },
      { name: "Предохранители", href: "/catalog?category=fuses" },
    ],
  },
  {
    title: "Остальное",
    items: [
      { name: "Электрооборудование", href: "/catalog?category=electrical" },
      { name: "Инструмент", href: "/catalog?category=tools" },
      { name: "Автоаксессуары", href: "/catalog?category=accessories" },
      { name: "Щётки стеклоочистителя", href: "/catalog?category=wipers" },
    ],
  },
];

export function Header({ user }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isBrandCatalogOpen, setIsBrandCatalogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/catalog?article=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-50">
      {/* Top Bar */}
      <div className="bg-neutral-950 border-b border-neutral-800/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-10 text-sm">
            <div className="hidden md:flex items-center gap-6">
              <div className="flex items-center gap-2 text-neutral-400">
                <MapPin className="h-4 w-4 text-orange-500" />
                <span>Екатеринбург, Заводская 16</span>
              </div>
              <div className="flex items-center gap-2 text-neutral-400">
                <Phone className="h-4 w-4 text-orange-500" />
                <span className="font-semibold text-white">+7 (932) 600-60-15</span>
              </div>
            </div>
            <div className="flex items-center gap-3 ml-auto">
              {!user ? (
                <>
                  <Link href="/auth/register" className="text-neutral-400 hover:text-orange-500 transition-colors">
                    Регистрация
                  </Link>
                  <Link href="/auth/login">
                    <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white h-7 px-4">
                      Войти
                    </Button>
                  </Link>
                </>
              ) : (
                <div className="relative group">
                  <button className="flex items-center gap-2 text-neutral-400 hover:text-orange-500 transition-colors">
                    <User className="h-4 w-4" />
                    <span className="font-medium text-white">{user.email?.split('@')[0]}</span>
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  <div className="absolute right-0 top-full mt-2 w-52 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 overflow-hidden">
                    <div className="py-2">
                      <Link href="/profile" className="block px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-orange-500 transition-colors">
                        Профиль
                      </Link>
                      <Link href="/dashboard" className="block px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-orange-500 transition-colors">
                        Личный кабинет
                      </Link>
                      <div className="border-t border-neutral-800 my-1"></div>
                      <div className="px-4 py-2">
                        <span className="text-xs text-neutral-500 flex items-center gap-1.5">
                          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                          JWT авторизован
                        </span>
                      </div>
                      <div className="border-t border-neutral-800 my-1"></div>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        Выйти
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="bg-neutral-900/95 backdrop-blur-xl border-b border-neutral-800/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-3 md:py-4 gap-3 md:gap-6">
            {/* Logo */}
            <Link href="/" className="shrink-0 flex items-center">
              <div className="bg-white rounded-full p-px">
                <Image
                  src="/logo.png"
                  alt="BroCar"
                  width={120}
                  height={48}
                  className="h-12 md:h-16 w-auto"
                  priority
                />
              </div>
            </Link>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="flex-1 max-w-2xl hidden md:block">
              <div className="relative">
                <input
                  type="text"
                  placeholder="VIN, номер кузова, артикул, наименование..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-5 py-3 pr-14 bg-neutral-800/50 border border-neutral-700/50 rounded-xl text-white placeholder-neutral-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none transition-all"
                />
                <button 
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-orange-500 hover:bg-orange-600 text-white p-2.5 rounded-lg transition-colors"
                >
                  <Search className="h-5 w-5" />
                </button>
              </div>
            </form>

            {/* Right Actions */}
            <div className="flex items-center gap-2 md:gap-3 shrink-0">
              <Link href="/vin-search" className="hidden lg:block">
                <Button variant="outline" className="flex items-center gap-2 border-neutral-700 text-neutral-300 hover:border-orange-500 hover:text-orange-500 bg-transparent h-12 px-4">
                  <Wrench className="h-5 w-5" />
                  <div className="text-left">
                    <div className="text-xs opacity-70">ПОДОБРАТЬ</div>
                    <div className="text-xs font-semibold">ЗАПЧАСТИ</div>
                  </div>
                </Button>
              </Link>
              <Link href="/cart">
                <Button variant="outline" className="flex items-center gap-2 border-orange-500/50 text-orange-500 hover:bg-orange-500 hover:text-white bg-transparent h-10 md:h-12 px-3 md:px-4 transition-all">
                  <ShoppingCart className="h-5 w-5" />
                  <span className="hidden lg:inline font-semibold">КОРЗИНА</span>
                </Button>
              </Link>
              
              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden text-neutral-300 hover:text-orange-500 hover:bg-neutral-800 h-10 w-10"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
          
          {/* Mobile Search */}
          <form onSubmit={handleSearch} className="md:hidden pb-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Поиск по артикулу или VIN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2.5 pr-11 bg-neutral-800/50 border border-neutral-700/50 rounded-xl text-white text-sm placeholder-neutral-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none transition-all"
              />
              <button 
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-orange-500 hover:bg-orange-600 text-white p-2 rounded-lg transition-colors"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Navigation Bar */}
      <div className="bg-neutral-900 border-b border-neutral-800/50 relative">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center h-12">
              <div
                className="relative h-full"
                onMouseEnter={() => setIsCatalogOpen(true)}
                onMouseLeave={() => setIsCatalogOpen(false)}
              >
                <button className="flex items-center gap-2 px-4 h-full text-neutral-300 hover:text-orange-500 font-medium transition-colors">
                  <Menu className="h-5 w-5" />
                  КАТАЛОГИ
                  <ChevronDown className={`h-4 w-4 transition-transform ${isCatalogOpen ? 'rotate-180' : ''}`} />
                </button>

                {isCatalogOpen && (
                  <div className="absolute left-0 top-full pt-0">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-b-2xl shadow-2xl p-6 min-w-[800px] animate-slide-down">
                      <div className="grid grid-cols-4 gap-8">
                        {CATALOG_ITEMS.map((section) => (
                          <div key={section.title}>
                            <h3 className="font-bold text-orange-500 mb-4 text-sm uppercase tracking-wide">
                              {section.title}
                            </h3>
                            <ul className="space-y-2.5">
                              {section.items.map((item) => (
                                <li key={item.name}>
                                  <Link
                                    href={item.href}
                                    className="text-sm text-neutral-400 hover:text-white transition-colors block"
                                  >
                                    {item.name}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Brand Catalog Dropdown */}
              <button
                onClick={() => setIsBrandCatalogOpen(!isBrandCatalogOpen)}
                className="flex items-center gap-2 px-4 h-full text-neutral-300 hover:text-orange-500 font-medium transition-colors"
              >
                АВТОМАРКИ
                <ChevronDown className={`h-4 w-4 transition-transform ${isBrandCatalogOpen ? 'rotate-180' : ''}`} />
              </button>

              <Link href="/vin-search" className="px-4 h-full flex items-center text-neutral-300 hover:text-orange-500 font-medium transition-colors">
                ЗАПРОС ПО VIN
              </Link>
              <Link href="/about" className="px-4 h-full flex items-center text-neutral-300 hover:text-orange-500 font-medium transition-colors">
                О НАС
              </Link>
              <Link href="/contacts" className="px-4 h-full flex items-center text-neutral-300 hover:text-orange-500 font-medium transition-colors">
                КОНТАКТЫ
              </Link>
            </nav>

            {/* Garage Button */}
            <Link href="/garage" className="hidden lg:block">
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 px-6 h-12 flex items-center gap-2 font-semibold text-white transition-all shadow-lg shadow-orange-500/25">
                ГАРАЖ
                <ChevronDown className="h-4 w-4" />
              </div>
            </Link>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="lg:hidden py-3 border-t border-neutral-800 animate-slide-down">
              {/* Contact info for mobile */}
              <div className="flex flex-col gap-2 px-4 py-3 mb-2 bg-neutral-800/30 rounded-lg">
                <a href="tel:+79326006015" className="flex items-center gap-2 text-white">
                  <Phone className="h-4 w-4 text-orange-500" />
                  <span className="font-semibold">+7 (932) 600-60-15</span>
                </a>
                <div className="flex items-center gap-2 text-neutral-400 text-sm">
                  <MapPin className="h-4 w-4 text-orange-500" />
                  <span>Екатеринбург, Заводская 16а</span>
                </div>
              </div>
              
              <nav className="flex flex-col space-y-1">
                <Link href="/catalog" className="px-4 py-3 text-neutral-300 hover:text-orange-500 hover:bg-neutral-800/50 rounded-lg transition-colors font-medium" onClick={() => setIsMenuOpen(false)}>
                  Каталоги
                </Link>
                <button
                  onClick={() => {
                    setIsBrandCatalogOpen(true);
                    setIsMenuOpen(false);
                  }}
                  className="px-4 py-3 text-neutral-300 hover:text-orange-500 hover:bg-neutral-800/50 rounded-lg text-left transition-colors font-medium"
                >
                  Автомарки
                </button>
                <Link href="/vin-search" className="px-4 py-3 text-neutral-300 hover:text-orange-500 hover:bg-neutral-800/50 rounded-lg transition-colors font-medium" onClick={() => setIsMenuOpen(false)}>
                  Запрос по VIN
                </Link>
                <Link href="/about" className="px-4 py-3 text-neutral-300 hover:text-orange-500 hover:bg-neutral-800/50 rounded-lg transition-colors font-medium" onClick={() => setIsMenuOpen(false)}>
                  О нас
                </Link>
                <Link href="/contacts" className="px-4 py-3 text-neutral-300 hover:text-orange-500 hover:bg-neutral-800/50 rounded-lg transition-colors font-medium" onClick={() => setIsMenuOpen(false)}>
                  Контакты
                </Link>
                <div className="pt-2">
                  <Link href="/garage" className="block px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold text-center" onClick={() => setIsMenuOpen(false)}>
                    Мой гараж
                  </Link>
                </div>
              </nav>
            </div>
          )}
        </div>

        {/* Brand Catalog Dropdown - Full Width */}
        <BrandCatalogDropdown
          isOpen={isBrandCatalogOpen}
          onClose={() => setIsBrandCatalogOpen(false)}
        />
      </div>
    </header>
  );
}
