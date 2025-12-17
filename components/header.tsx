"use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, User, Menu, ChevronDown, MapPin, Phone, Wrench, LogOut } from "lucide-react";
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
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <header className="bg-white sticky top-0 z-50 shadow-sm">
      {/* Top Bar */}
      <div className="bg-gray-100 border-b border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-10 text-sm">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-gray-700">
                <MapPin className="h-4 w-4" />
                <span>Калининград, Советский проспект, д. 182</span>
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <Phone className="h-4 w-4" />
                <span className="font-semibold">+7(401)275-8888</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!user ? (
                <>
                  <Link href="/auth/register" className="text-gray-700 hover:text-blue-600">
                    Регистрация
                  </Link>
                  <Link href="/auth/login">
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-7">
                      Войти
                    </Button>
                  </Link>
                </>
              ) : (
                <div className="relative group">
                  <button className="flex items-center gap-2 text-gray-700 hover:text-blue-600">
                    <User className="h-4 w-4" />
                    <span className="font-medium">{user.email?.split('@')[0]}</span>
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="py-2">
                      <Link href="/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600">
                        Профиль
                      </Link>
                      <Link href="/dashboard" className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600">
                        Личный кабинет
                      </Link>
                      <div className="border-t border-gray-200 my-1"></div>
                      <div className="px-4 py-2">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          JWT авторизован
                        </span>
                      </div>
                      <div className="border-t border-gray-200 my-1"></div>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
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
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-4 gap-6">
          {/* Logo */}
          <Link href="/" className="shrink-0">
            <Image
              src="/logo.png"
              alt="BroCar"
              width={120}
              height={48}
              className="h-20 w-auto"
              priority
            />
          </Link>

          {/* Search Bar - Large centered */}
          <div className="flex-1 max-w-3xl">
            <div className="relative">
              <input
                type="text"
                placeholder="VIN, номер кузова (без тире), артикул, наименование"
                className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
              />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/parts-finder">
              <Button variant="outline" className="hidden lg:flex items-center gap-2 border-blue-600 text-blue-600 hover:bg-blue-50">
                <Wrench className="h-4 w-4" />
                <div className="text-left">
                  <div className="text-xs">ПОДОБРАТЬ</div>
                  <div className="text-xs font-semibold">ЗАПЧАСТИ</div>
                </div>
              </Button>
            </Link>
            <Link href="/cart">
              <Button variant="outline" className="flex items-center gap-2 border-gray-300 hover:border-blue-600 hover:text-blue-600">
                <ShoppingCart className="h-5 w-5" />
                <span className="hidden lg:inline font-semibold">КОРЗИНА</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Navigation Bar - Blue */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white relative">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center h-12">
              <div
                className="relative h-full"
                onMouseEnter={() => setIsCatalogOpen(true)}
                onMouseLeave={() => setIsCatalogOpen(false)}
              >
                <button className="flex items-center gap-1 px-4 h-full hover:bg-blue-700 font-medium">
                  <Menu className="h-5 w-5" />
                  КАТАЛОГИ
                  <ChevronDown className="h-4 w-4" />
                </button>

                {isCatalogOpen && (
                  <div className="absolute left-0 top-full pt-0">
                    <div className="bg-white border border-gray-200 rounded-b-lg shadow-2xl p-6 min-w-[800px] text-gray-900">
                      <div className="grid grid-cols-4 gap-6">
                        {CATALOG_ITEMS.map((section) => (
                          <div key={section.title}>
                            <h3 className="font-bold text-gray-900 mb-3 text-sm">
                              {section.title}
                            </h3>
                            <ul className="space-y-2">
                              {section.items.map((item) => (
                                <li key={item.name}>
                                  <Link
                                    href={item.href}
                                    className="text-sm text-gray-600 hover:text-blue-600 block"
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
              <div className="relative h-full">
                <button
                  onClick={() => setIsBrandCatalogOpen(!isBrandCatalogOpen)}
                  className="flex items-center gap-1 px-4 h-full hover:bg-blue-700 font-medium"
                >
                  АВТОТОЧКИ
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>

              <Link href="/vin-search" className="px-4 h-full flex items-center hover:bg-blue-700 font-medium">
                ЗАПРОС ПО VIN
              </Link>
              <Link href="/forum" className="px-4 h-full flex items-center hover:bg-blue-700 font-medium">
                ФОРУМ
              </Link>
              <Link href="/club" className="px-4 h-full flex items-center hover:bg-blue-700 font-medium">
                КЛУБ
              </Link>
            </nav>

            {/* Garage Button */}
            <Link href="/garage" className="hidden lg:block">
              <div className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 px-6 h-12 flex items-center gap-2 font-medium">
                ГАРАЖ
                <ChevronDown className="h-4 w-4" />
              </div>
            </Link>

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-white hover:bg-blue-700"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="lg:hidden py-4 border-t border-blue-700">
              <nav className="flex flex-col space-y-2">
                <Link href="/catalog" className="px-4 py-2 hover:bg-blue-700 rounded" onClick={() => setIsMenuOpen(false)}>
                  КАТАЛОГИ
                </Link>
                <button
                  onClick={() => {
                    setIsBrandCatalogOpen(true);
                    setIsMenuOpen(false);
                  }}
                  className="px-4 py-2 hover:bg-blue-700 rounded text-left"
                >
                  АВТОТОЧКИ
                </button>
                <Link href="/vin-search" className="px-4 py-2 hover:bg-blue-700 rounded" onClick={() => setIsMenuOpen(false)}>
                  ЗАПРОС ПО VIN
                </Link>
                <Link href="/dealers" className="px-4 py-2 hover:bg-blue-700 rounded" onClick={() => setIsMenuOpen(false)}>
                  АВТОТОЧКИ
                </Link>
                <Link href="/forum" className="px-4 py-2 hover:bg-blue-700 rounded" onClick={() => setIsMenuOpen(false)}>
                  ФОРУМ
                </Link>
                <Link href="/club" className="px-4 py-2 hover:bg-blue-700 rounded" onClick={() => setIsMenuOpen(false)}>
                  КЛУБ
                </Link>
                <Link href="/garage" className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded" onClick={() => setIsMenuOpen(false)}>
                  ГАРАЖ
                </Link>
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
