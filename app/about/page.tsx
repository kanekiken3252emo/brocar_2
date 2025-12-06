import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "О нас",
  description: "Информация о компании BroCar - профессиональный поставщик автозапчастей",
};

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold">О компании BroCar</h1>

        <Card>
          <CardHeader>
            <CardTitle>Кто мы</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              BroCar — это современный интернет-магазин автозапчастей,
              предоставляющий широкий ассортимент качественных деталей для
              автомобилей всех марок и моделей.
            </p>
            <p>
              Мы работаем напрямую с ведущими поставщиками и производителями
              автозапчастей, что позволяет нам предлагать конкурентные цены и
              гарантировать подлинность всех товаров.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Наши преимущества</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
                <span>
                  <strong>Широкий ассортимент:</strong> Доступ к базам
                  нескольких крупных поставщиков
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
                <span>
                  <strong>Конкурентные цены:</strong> Постоянный мониторинг рынка
                  и гибкая ценовая политика
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
                <span>
                  <strong>Быстрая доставка:</strong> Отправка заказов в день
                  оформления
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
                <span>
                  <strong>Гарантия качества:</strong> Все запчасти сертифицированы
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
                <span>
                  <strong>Профессиональная поддержка:</strong> Консультации по
                  подбору запчастей
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Как мы работаем</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">1. Поиск запчастей</h3>
              <p className="text-gray-600">
                Введите артикул или бренд нужной детали. Наша система
                автоматически проверит наличие у всех наших поставщиков.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">2. Выбор предложения</h3>
              <p className="text-gray-600">
                Сравните цены и сроки доставки от разных поставщиков и выберите
                оптимальный вариант.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">3. Оформление заказа</h3>
              <p className="text-gray-600">
                Добавьте товары в корзину и оформите заказ. Доступны различные
                способы оплаты.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">4. Доставка</h3>
              <p className="text-gray-600">
                Получите заказ удобным для вас способом: курьерской доставкой
                или самовывозом.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}




