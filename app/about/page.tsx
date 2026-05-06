import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AboutGallery } from "@/components/about-gallery";

export const metadata: Metadata = {
  title: "О нас",
  description: "Информация о компании BroCar - профессиональный поставщик автозапчастей",
};

const ADVANTAGES = [
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
    title: "Оперативная поддержка",
    description: "Консультации по подбору запчастей от специалистов",
  },
  {
    img: "/fast-poisk.png",
    title: "Моментальный поиск",
    description: "Работаем напрямую с поставщиками без посредников",
  },
  {
    img: "/ekspertnaya-podderjka.png",
    title: "Экспертная помощь",
    description: "Доверяют нам и возвращаются снова",
  },
  {
    img: "/proverennoe-kachestvo.png",
    title: "Проверенное качество",
    description: "Широкий ассортимент для любых автомобилей",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Поиск запчастей",
    description: "Введите артикул или VIN-код. Наша система автоматически проверит наличие у всех поставщиков.",
  },
  {
    number: "02",
    title: "Выбор предложения",
    description: "Сравните цены и сроки доставки от разных поставщиков и выберите оптимальный вариант.",
  },
  {
    number: "03",
    title: "Оформление заказа",
    description: "Добавьте товары в корзину и оформите заказ. Доступны различные способы оплаты.",
  },
  {
    number: "04",
    title: "Доставка",
    description: "Получите заказ удобным способом: курьерской доставкой или самовывозом.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-600/20 via-neutral-950 to-neutral-950" />
        <div className="absolute top-20 right-20 w-72 h-72 bg-orange-500/20 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              О компании <span className="text-orange-500">BroCar</span>
            </h1>
            <p className="text-xl text-neutral-400 mb-8">
              Профессиональный поставщик автозапчастей с 2014 года. 
              Мы работаем напрямую с ведущими производителями и поставщиками, 
              гарантируя качество и лучшие цены.
            </p>
            <Link href="/catalog">
              <Button size="lg">
                Перейти в каталог
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Advantages Section */}
      <section className="py-20 border-t border-neutral-800/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Наши преимущества</h2>
            <p className="text-neutral-400 max-w-2xl mx-auto">
              Почему тысячи автовладельцев выбирают BroCar
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ADVANTAGES.map((item) => (
              <Card key={item.title} className="border-neutral-800 bg-neutral-900 hover:border-orange-500/50 transition-colors">
                <CardContent className="p-6">
                  <div className="w-12 h-12 mb-4">
                    <Image
                      src={item.img}
                      alt={item.title}
                      width={48}
                      height={48}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-neutral-400">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Shop Gallery Section */}
      <section className="py-20 border-t border-neutral-800/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Наш магазин</h2>
            <p className="text-neutral-400 max-w-2xl mx-auto">
              Екатеринбург, ул. Заводская, 16 — приходите, мы всегда рады помочь
            </p>
          </div>

          <AboutGallery />
        </div>
      </section>

      {/* How We Work Section */}
      <section className="py-20 bg-neutral-900/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Как мы работаем</h2>
            <p className="text-neutral-400 max-w-2xl mx-auto">
              Простой процесс заказа запчастей в 4 шага
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((step, index) => (
              <div key={step.number} className="relative">
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 h-full hover:border-orange-500/50 transition-colors">
                  <div className="text-5xl font-bold text-orange-500/20 mb-4">{step.number}</div>
                  <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-neutral-400 text-sm">{step.description}</p>
                </div>
                {index < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-0.5 bg-neutral-700" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-orange-600/5">
            <CardContent className="p-8 md:p-12 text-center">
              <h2 className="text-3xl font-bold text-white mb-4">
                Готовы найти нужные запчасти?
              </h2>
              <p className="text-neutral-400 mb-8 max-w-xl mx-auto">
                Воспользуйтесь поиском по артикулу, VIN-коду или выберите марку автомобиля
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link href="/catalog">
                  <Button size="lg">
                    Перейти в каталог
                  </Button>
                </Link>
                <Link href="/contacts">
                  <Button size="lg" variant="outline">
                    Связаться с нами
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
