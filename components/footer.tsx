import Link from "next/link";
import Image from "next/image";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-gray-50 mt-auto">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* О компании */}
          <div>
            <Link href="/" className="inline-block mb-4">
              <Image
                src="/logo.png"
                alt="BroCar"
                width={100}
                height={40}
                className="h-20 w-auto"
              />
            </Link>
            <p className="text-sm text-gray-600 mb-4">
              Профессиональный поставщик автозапчастей по всей России
            </p>
            <p className="text-sm text-gray-600">
              Мы предлагаем широкий ассортимент качественных запчастей от
              проверенных поставщиков с гарантией и быстрой доставкой.
            </p>
          </div>

          {/* Каталог */}
          <div>
            <h4 className="font-semibold mb-4 text-gray-900">Каталог</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/catalog?category=oils"
                  className="text-gray-600 hover:text-blue-600"
                >
                  Масла и жидкости
                </Link>
              </li>
              <li>
                <Link
                  href="/catalog?category=filters"
                  className="text-gray-600 hover:text-blue-600"
                >
                  Фильтры
                </Link>
              </li>
              <li>
                <Link
                  href="/catalog?category=brakes"
                  className="text-gray-600 hover:text-blue-600"
                >
                  Тормозная система
                </Link>
              </li>
              <li>
                <Link
                  href="/catalog?category=suspension"
                  className="text-gray-600 hover:text-blue-600"
                >
                  Подвеска
                </Link>
              </li>
              <li>
                <Link
                  href="/catalog?category=electrical"
                  className="text-gray-600 hover:text-blue-600"
                >
                  Электрооборудование
                </Link>
              </li>
              <li>
                <Link
                  href="/catalog"
                  className="text-gray-600 hover:text-blue-600"
                >
                  Все запчасти
                </Link>
              </li>
            </ul>
          </div>

          {/* Правовая информация */}
          <div>
            <h4 className="font-semibold mb-4 text-gray-900">
              Правовая информация
            </h4>
            <ul className="space-y-2 text-sm mb-6">
              <li>
                <Link
                  href="/legal/privacy"
                  className="text-gray-600 hover:text-blue-600"
                >
                  Политика конфиденциальности
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/terms"
                  className="text-gray-600 hover:text-blue-600"
                >
                  Условия использования
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/cookies"
                  className="text-gray-600 hover:text-blue-600"
                >
                  Cookie-файлы
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="text-gray-600 hover:text-blue-600"
                >
                  О нас
                </Link>
              </li>
              <li>
                <Link
                  href="/contacts"
                  className="text-gray-600 hover:text-blue-600"
                >
                  Контакты
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t pt-6 text-center text-sm text-gray-600">
          <p>
            &copy; {currentYear} BroCar. Все права защищены.
          </p>
        </div>
      </div>
    </footer>
  );
}


