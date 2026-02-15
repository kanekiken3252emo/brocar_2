import Link from "next/link";
import Image from "next/image";
import { Mail, Phone, MapPin, ArrowUpRight } from "lucide-react";

function VkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12.785 16.241s.288-.032.436-.194c.136-.148.132-.427.132-.427s-.02-1.304.587-1.496c.598-.189 1.367 1.259 2.182 1.815.616.42 1.084.328 1.084.328l2.175-.03s1.14-.07.599-.964c-.044-.073-.314-.661-1.618-1.869-1.366-1.265-1.183-1.06.462-3.248.999-1.33 1.398-2.142 1.273-2.49-.12-.331-.854-.244-.854-.244l-2.45.015s-.182-.025-.317.056c-.131.079-.216.263-.216.263s-.387 1.028-.903 1.903c-1.089 1.85-1.524 1.948-1.702 1.833-.414-.267-.31-1.075-.31-1.649 0-1.793.272-2.54-.53-2.733-.266-.064-.462-.106-1.143-.113-.874-.009-1.614.003-2.033.208-.279.136-.494.44-.363.457.162.022.528.099.723.363.25.341.242 1.11.242 1.11s.144 2.11-.336 2.372c-.33.18-.781-.187-1.75-1.866-.496-.86-.871-1.81-.871-1.81s-.072-.177-.201-.272c-.156-.115-.374-.151-.374-.151l-2.328.015s-.35.01-.478.161c-.114.135-.009.414-.009.414s1.816 4.244 3.871 6.381c1.884 1.96 4.025 1.832 4.025 1.832h.97z" />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function TwoGisIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-.5 5.5h2.8c1.3 0 2.2.9 2.2 2.2 0 .9-.5 1.6-1.2 1.9.9.2 1.5 1.1 1.5 2.1 0 1.4-1 2.4-2.4 2.4H11.5V5.5zm1.5 3.5h1.2c.5 0 .8-.3.8-.8s-.3-.8-.8-.8H13V9zm0 3.6h1.3c.6 0 .9-.4.9-.9s-.3-.9-.9-.9H13v1.8zM7 17.5v-1.3l2.5-2.7c.6-.7.8-1 .8-1.5 0-.6-.4-.9-.9-.9-.5 0-.9.3-1.1.8L7 11.3c.3-1 1.2-1.8 2.5-1.8 1.4 0 2.4.9 2.4 2.2 0 .8-.3 1.4-1.2 2.4l-1.3 1.4h2.6v1.5H7z" />
    </svg>
  );
}

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
                href="tel:+79326006052" 
                className="w-10 h-10 bg-neutral-800 hover:bg-orange-500 rounded-lg flex items-center justify-center transition-colors group"
                title="Позвонить"
              >
                <Phone className="h-5 w-5 text-neutral-400 group-hover:text-white" />
              </a>
              <a 
                href="https://vk.com/brocarparts" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-neutral-800 hover:bg-[#0077FF] rounded-lg flex items-center justify-center transition-colors group"
                title="ВКонтакте"
              >
                <VkIcon className="h-5 w-5 text-neutral-400 group-hover:text-white" />
              </a>
              <a 
                href="https://t.me/+79326006052" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-neutral-800 hover:bg-[#26A5E4] rounded-lg flex items-center justify-center transition-colors group"
                title="Telegram"
              >
                <TelegramIcon className="h-5 w-5 text-neutral-400 group-hover:text-white" />
              </a>
              <a 
                href="https://2gis.ru/ekaterinburg/firm/70000001098987045" 
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 bg-neutral-800 hover:bg-neutral-700 rounded-lg flex items-center justify-center transition-colors px-2"
                title="2ГИС"
              >
                <Image
                  src="/2gis-footer-logo.png"
                  alt="2ГИС"
                  width={80}
                  height={32}
                  className="h-7 w-auto object-contain invert brightness-90"
                />
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
              <p className="text-neutral-400 text-xs md:text-sm">Пн — Пт: 10:00 — 18:00</p>
              <p className="text-neutral-500 text-xs md:text-sm">Сб — Вс: выходной</p>
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
