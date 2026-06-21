"use client";

import Link from "next/link";
import StoryLogo from "@/components/stories/StoryLogo";
import { ShoppingCart, User, Menu, ChevronDown, MapPin, Phone, Wrench, LogOut, Search, X, Car, ClipboardList } from "lucide-react";
import { Button } from "./ui/button";
import { useEffect, useState } from "react";
import BrandCatalogDropdown from "./BrandCatalogDropdown";
import { usePathname, useRouter } from "next/navigation";

interface HeaderProps {
  user?: any;
}

const CATALOG_ITEMS = [
  {
    title: "Масла и жидкости",
    items: [
      { name: "Масла моторные", href: "/catalog?category=engine-oils" },
      { name: "Масла трансмиссионные", href: "/catalog?category=transmission-oils" },
      { name: "Охлаждающие жидкости", href: "/catalog?category=coolants" },
      { name: "Жидкости тормозные", href: "/catalog?category=brake-fluids" },
      { name: "Жидкости для омывателя", href: "/catalog?category=washer-fluids" },
    ],
  },
  {
    title: "Фильтры",
    items: [
      { name: "Масляные", href: "/catalog?category=oil-filters" },
      { name: "Воздушные", href: "/catalog?category=air-filters" },
      { name: "Топливные", href: "/catalog?category=fuel-filters" },
      { name: "Салона", href: "/catalog?category=cabin-filters" },
    ],
  },
  {
    title: "Тормозная система",
    items: [
      { name: "Колодки тормозные", href: "/catalog?category=brake-pads" },
      { name: "Диски тормозные", href: "/catalog?category=brake-discs" },
      { name: "Шланги тормозные", href: "/catalog?category=brake-hoses" },
    ],
  },
  {
    title: "Подвеска и ходовая",
    items: [
      { name: "Амортизаторы", href: "/catalog?category=shock-absorbers" },
      { name: "Сайлентблоки", href: "/catalog?category=silent-blocks" },
      { name: "Стойки стабилизатора", href: "/catalog?category=stabilizer-links" },
      { name: "ШРУСы", href: "/catalog?category=cv-joints" },
      { name: "Подшипники", href: "/catalog?category=bearings" },
    ],
  },
  {
    title: "Электрика",
    items: [
      { name: "Лампы", href: "/catalog?category=lamps" },
      { name: "Аккумуляторы", href: "/catalog?category=batteries" },
      { name: "Свечи зажигания", href: "/catalog?category=spark-plugs" },
      { name: "Датчики", href: "/catalog?category=sensors" },
      { name: "Генераторы", href: "/catalog?category=alternators" },
      { name: "Стартеры", href: "/catalog?category=starters" },
    ],
  },
  {
    title: "Кузов и аксессуары",
    items: [
      { name: "Щётки стеклоочистителя", href: "/catalog?category=wipers" },
      { name: "Колёсные диски", href: "/catalog?category=wheels" },
      { name: "Автохимия и аксессуары", href: "/catalog?category=accessories" },
      { name: "Все категории", href: "/catalog" },
    ],
  },
];

export function Header({ user }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isBrandCatalogOpen, setIsBrandCatalogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [cartCount, setCartCount] = useState(0);
  const [hidden, setHidden] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Авто-скрытие хедера на МОБИЛКЕ: прячем при скролле вниз (освобождает экран,
  // т.к. хедер высокий), показываем при скролле вверх и у верха страницы.
  // На десктопе хедер не трогаем — трансформация навешана через max-lg: ниже.
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (Math.abs(y - lastY) > 6) {
          setHidden(y > lastY && y > 120);
          lastY = y;
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Блокируем скролл фона, пока открыто мобильное меню — иначе палец скроллил
  // страницу под меню. Само меню скроллится внутри (overflow-y-auto ниже).
  useEffect(() => {
    if (!isMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMenuOpen]);

  // Счётчик товаров в корзине.
  //  - cart:landed (шарик долетел до корзины) — мгновенный оптимистичный +qty,
  //    не ждём ответа сервера;
  //  - cart:added / cart:error — отложенная сверка с сервером (исправляет
  //    счётчик, если добавление в итоге не удалось);
  //  - cart:updated (правки на странице корзины) и смена страницы — обычный
  //    перезапрос.
  useEffect(() => {
    let alive = true;
    let reconcileTimer: ReturnType<typeof setTimeout> | null = null;

    const refresh = () => {
      fetch("/api/cart")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!alive || !data) return;
          const count = (data.items || []).reduce(
            (sum: number, item: { qty?: number }) => sum + (item.qty ?? 1),
            0
          );
          setCartCount(count);
        })
        .catch(() => {});
    };

    // Сверяемся после того как анимация полёта точно закончилась, чтобы
    // ответ сервера не «перетёр» цифру до оптимистичного инкремента.
    const scheduleReconcile = () => {
      if (reconcileTimer) clearTimeout(reconcileTimer);
      reconcileTimer = setTimeout(refresh, 1200);
    };

    const onLanded = (e: Event) => {
      const qty = (e as CustomEvent).detail?.qty ?? 1;
      setCartCount((c) => c + qty);
    };

    refresh();
    window.addEventListener("cart:landed", onLanded);
    window.addEventListener("cart:added", scheduleReconcile);
    window.addEventListener("cart:error", scheduleReconcile);
    window.addEventListener("cart:updated", refresh);
    return () => {
      alive = false;
      if (reconcileTimer) clearTimeout(reconcileTimer);
      window.removeEventListener("cart:landed", onLanded);
      window.removeEventListener("cart:added", scheduleReconcile);
      window.removeEventListener("cart:error", scheduleReconcile);
      window.removeEventListener("cart:updated", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleLogout = async () => {
    // Ленивый импорт supabase-js: тяжёлый клиент грузится только при клике
    // «Выйти», а не в составе бандла заголовка на каждой странице.
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    // 17-значный VIN → каталог по VIN; остальное (артикул/наименование) →
    // обычный поиск по поставщикам. VIN-набор исключает буквы I, O, Q.
    const compact = q.replace(/\s+/g, "");
    if (/^[A-HJ-NPR-Z0-9]{17}$/i.test(compact)) {
      router.push(`/catalog-vin?vin=${encodeURIComponent(compact.toUpperCase())}`);
    } else {
      router.push(`/catalog?article=${encodeURIComponent(q)}`);
    }
  };

  return (
    <header
      className={`sticky top-0 z-50 transition-transform duration-300 ${
        hidden && !isMenuOpen ? "max-lg:-translate-y-full" : ""
      }`}
    >
      {/* Top Bar */}
      <div className="bg-neutral-950">
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
                <span className="text-neutral-600">·</span>
                <span className="font-semibold text-white">8 (343) 382-20-62</span>
              </div>
            </div>
            {/* Мобильный номер слева на мобилке (десктоп — в блоке слева выше) */}
            <a
              href="tel:+79326006015"
              className="md:hidden flex items-center gap-1.5 text-white font-semibold whitespace-nowrap"
            >
              <Phone className="h-4 w-4 text-orange-500" />
              +7 (932) 600-60-15
            </a>
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
      <div className="bg-neutral-950 border-b border-neutral-800/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-3 md:py-4 gap-3 md:gap-6">
            {/* Логотип + истории (кольцо на лого, тап → полноэкранные истории) */}
            <StoryLogo />

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="flex-1 max-w-2xl hidden md:block">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Поиск по артикулу, наименованию или VIN..."
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
              <Link href="/catalog-vin" className="hidden lg:block">
                <Button variant="outline" className="flex items-center gap-2 border-neutral-700 text-neutral-300 hover:border-orange-500 hover:text-orange-500 bg-transparent h-12 px-4">
                  <Wrench className="h-5 w-5" />
                  <div className="text-left">
                    <div className="text-xs opacity-70">ПОДОБРАТЬ</div>
                    <div className="text-xs font-semibold">ПО VIN</div>
                  </div>
                </Button>
              </Link>
              <Link href="/catalog-vin" className="lg:hidden">
                <Button className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white h-10 px-3 text-xs font-semibold">
                  <Car className="h-4 w-4" />
                  VIN
                </Button>
              </Link>
              <Link href="/cart" className="relative" id="header-cart-target">
                <Button variant="outline" className="flex items-center gap-2 border-orange-500/50 text-orange-500 hover:bg-orange-500 hover:text-white bg-transparent h-10 md:h-12 px-3 md:px-4 transition-all">
                  <ShoppingCart className="h-5 w-5" />
                  <span className="hidden lg:inline font-semibold">КОРЗИНА</span>
                </Button>
                {cartCount > 0 && (
                  <span
                    key={cartCount}
                    className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-orange-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center ring-2 ring-neutral-950 animate-cart-pop pointer-events-none"
                  >
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
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
                placeholder="Поиск по артикулу, наименованию или VIN..."
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

              <Link
                href="/catalog"
                className="px-4 h-full flex items-center text-neutral-300 hover:text-orange-500 font-medium transition-colors"
              >
                КАТАЛОГ
              </Link>

              {/* Brand Catalog Dropdown */}
              <button
                onClick={() => setIsBrandCatalogOpen(!isBrandCatalogOpen)}
                className="flex items-center gap-2 px-4 h-full text-neutral-300 hover:text-orange-500 font-medium transition-colors"
              >
                АВТОМАРКИ
                <ChevronDown className={`h-4 w-4 transition-transform ${isBrandCatalogOpen ? 'rotate-180' : ''}`} />
              </button>

              <Link href="/catalog-vin" className="px-4 h-full flex items-center text-neutral-300 hover:text-orange-500 font-medium transition-colors">
                КАТАЛОГ ПО VIN
              </Link>
              <Link href="/guides" className="px-4 h-full flex items-center text-neutral-300 hover:text-orange-500 font-medium transition-colors">
                ПОМОЩЬ С ВЫБОРОМ
              </Link>
              <Link href="/about" className="px-4 h-full flex items-center text-neutral-300 hover:text-orange-500 font-medium transition-colors">
                О НАС
              </Link>
              <Link href="/contacts" className="px-4 h-full flex items-center text-neutral-300 hover:text-orange-500 font-medium transition-colors">
                КОНТАКТЫ
              </Link>
            </nav>

            {/* My Orders + Garage — единый блок справа */}
            <div className="hidden lg:flex items-center">
              {/* My Orders */}
              <Link href="/dashboard" className="group/orders">
                <div className="relative px-5 h-12 flex items-center gap-2 font-semibold text-neutral-200 bg-neutral-800/70 border border-r-0 border-orange-500/30 hover:border-orange-500/70 hover:text-white transition-all cursor-pointer overflow-hidden">
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/10 to-orange-500/25 opacity-0 group-hover/orders:opacity-100 transition-opacity duration-300" />
                  <ClipboardList className="h-4 w-4 text-orange-500 relative" />
                  <span className="relative">МОИ ЗАКАЗЫ</span>
                </div>
              </Link>

              {/* Garage */}
              <Link href="/garage">
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 px-6 h-12 flex items-center gap-2 font-semibold text-white transition-all shadow-lg shadow-orange-500/25 cursor-pointer">
                  <Car className="h-4 w-4" />
                  ГАРАЖ
                </div>
              </Link>
            </div>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="lg:hidden py-3 pb-8 border-t border-neutral-800 animate-slide-down max-h-[calc(100dvh_-_11rem)] overflow-y-auto overscroll-contain">
              {/* Contact info for mobile */}
              <div className="flex flex-col gap-2 px-4 py-3 mb-2 bg-neutral-800/30 rounded-lg">
                <a href="tel:+79326006015" className="flex items-center gap-2 text-white">
                  <Phone className="h-4 w-4 text-orange-500" />
                  <span className="font-semibold">+7 (932) 600-60-15</span>
                </a>
                <a href="tel:+73433822062" className="flex items-center gap-2 text-white">
                  <Phone className="h-4 w-4 text-orange-500" />
                  <span className="font-semibold">8 (343) 382-20-62</span>
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
                <Link href="/catalog-vin" className="px-4 py-3 text-neutral-300 hover:text-orange-500 hover:bg-neutral-800/50 rounded-lg transition-colors font-medium" onClick={() => setIsMenuOpen(false)}>
                  Каталог по VIN
                </Link>
                <Link href="/guides" className="px-4 py-3 text-neutral-300 hover:text-orange-500 hover:bg-neutral-800/50 rounded-lg transition-colors font-medium" onClick={() => setIsMenuOpen(false)}>
                  Помощь с выбором
                </Link>
                <Link href="/about" className="px-4 py-3 text-neutral-300 hover:text-orange-500 hover:bg-neutral-800/50 rounded-lg transition-colors font-medium" onClick={() => setIsMenuOpen(false)}>
                  О нас
                </Link>
                <Link href="/contacts" className="px-4 py-3 text-neutral-300 hover:text-orange-500 hover:bg-neutral-800/50 rounded-lg transition-colors font-medium" onClick={() => setIsMenuOpen(false)}>
                  Контакты
                </Link>
                <div className="pt-2 space-y-2">
                  <Link href="/garage" className="block px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold text-center" onClick={() => setIsMenuOpen(false)}>
                    Мой гараж
                  </Link>
                  <Link href="/dashboard" className="flex items-center justify-center gap-2 px-4 py-3 border border-neutral-700 text-neutral-200 hover:text-orange-500 hover:border-orange-500/50 rounded-xl font-semibold transition-colors" onClick={() => setIsMenuOpen(false)}>
                    <ClipboardList className="h-4 w-4" />
                    Мои заказы
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
