import Link from "next/link";
import Image from "next/image";
import { Mail, Phone, MapPin, ArrowUpRight } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-neutral-950 border-t border-neutral-800/50 mt-auto">
      {/* Main Footer */}
      <div className="container mx-auto px-4 py-8 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-12">
          {/* Company Info */}
          <div className="col-span-2 md:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-block mb-4 md:mb-6">
              <div className="bg-white rounded-full p-px inline-block">
                <Image
                  src="/logo.png"
                  alt="BroCar"
                  width={120}
                  height={48}
                  className="h-10 md:h-14 w-auto"
                />
              </div>
            </Link>
            <p className="text-neutral-400 mb-4 md:mb-6 leading-relaxed text-sm md:text-base">
              Профессиональный поставщик автозапчастей. Широкий ассортимент качественных деталей.
            </p>
            <div className="flex items-center gap-3">
              <a 
                href="tel:+79326006015" 
                className="w-10 h-10 bg-neutral-800 hover:bg-orange-500 rounded-lg flex items-center justify-center transition-colors group"
              >
                <Phone className="h-5 w-5 text-neutral-400 group-hover:text-white" />
              </a>
              <a 
                href="mailto:info@brocar.ru" 
                className="w-10 h-10 bg-neutral-800 hover:bg-orange-500 rounded-lg flex items-center justify-center transition-colors group"
              >
                <Mail className="h-5 w-5 text-neutral-400 group-hover:text-white" />
              </a>
              <a 
                href="#" 
                className="w-10 h-10 bg-neutral-800 hover:bg-orange-500 rounded-lg flex items-center justify-center transition-colors group"
              >
                <MapPin className="h-5 w-5 text-neutral-400 group-hover:text-white" />
              </a>
            </div>
          </div>

          {/* Catalog */}
          <div>
            <h4 className="text-white font-semibold mb-3 md:mb-6 text-sm md:text-lg">Каталог</h4>
            <ul className="space-y-2 md:space-y-3">
              {[
                { name: "Масла", href: "/catalog?category=oils" },
                { name: "Фильтры", href: "/catalog?category=filters" },
                { name: "Тормоза", href: "/catalog?category=brakes" },
                { name: "Подвеска", href: "/catalog?category=suspension" },
                { name: "Все запчасти", href: "/catalog" },
              ].map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-neutral-400 hover:text-orange-500 transition-colors text-sm md:text-base"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Information */}
          <div>
            <h4 className="text-white font-semibold mb-3 md:mb-6 text-sm md:text-lg">Информация</h4>
            <ul className="space-y-2 md:space-y-3">
              {[
                { name: "О компании", href: "/about" },
                { name: "Контакты", href: "/contacts" },
                { name: "Доставка", href: "/delivery" },
                { name: "Оплата", href: "/payment" },
              ].map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-neutral-400 hover:text-orange-500 transition-colors text-sm md:text-base"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal & Working Hours */}
          <div className="col-span-2 md:col-span-1">
            <h4 className="text-white font-semibold mb-3 md:mb-6 text-sm md:text-lg">Правовая информация</h4>
            <ul className="space-y-2 md:space-y-3 mb-4 md:mb-0">
              {[
                { name: "Политика конфиденциальности", href: "/legal/privacy" },
                { name: "Условия использования", href: "/legal/terms" },
                { name: "Cookie-файлы", href: "/legal/cookies" },
              ].map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-neutral-400 hover:text-orange-500 transition-colors text-sm md:text-base"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
            
            {/* Contact Info - Hidden on very small screens, shown inline on md+ */}
            <div className="mt-4 md:mt-8 p-3 md:p-4 bg-neutral-900 rounded-lg md:rounded-xl border border-neutral-800">
              <p className="text-orange-500 font-semibold mb-1 md:mb-2 text-sm md:text-base">Режим работы</p>
              <p className="text-neutral-400 text-xs md:text-sm">Пн-Пт: 9:00 - 18:00</p>
              <p className="text-neutral-400 text-xs md:text-sm">Сб-Вс: 10:00 - 16:00</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-neutral-800/50">
        <div className="container mx-auto px-4 py-4 md:py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-2 md:gap-4">
            <p className="text-neutral-500 text-xs md:text-sm">
              © {currentYear} BroCar. Все права защищены.
            </p>
            <p className="text-neutral-600 text-xs md:text-sm">
              Разработано с <span className="text-orange-500">♥</span> для автолюбителей
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
