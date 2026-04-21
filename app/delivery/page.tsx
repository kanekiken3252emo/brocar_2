import { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  MapPin,
  Truck,
  Package,
  Clock,
  Phone,
  ChevronRight,
  CheckCircle2,
  ArrowRight,
  Building2,
  Globe,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Доставка",
  description: "Условия доставки автозапчастей по Екатеринбургу и всей России — BroCar",
};

const EKATERINBURG_OPTIONS = [
  {
    icon: <Building2 className="h-5 w-5 text-orange-500" />,
    title: "Самовывоз",
    desc: "Екатеринбург, ул. Заводская, 16 (1 этаж, район ВИЗ)",
    detail: "Пн — Пт: 10:00 — 18:00",
    badge: "Бесплатно",
    badgeColor: "text-green-400 bg-green-500/10",
  },
  {
    icon: <Truck className="h-5 w-5 text-orange-500" />,
    title: "Курьер по Екатеринбургу",
    desc: "Доставка по городу в удобное для вас время",
    detail: "Уточняйте стоимость по телефону",
    badge: "По договорённости",
    badgeColor: "text-orange-400 bg-orange-500/10",
  },
];

const TRANSPORT_COMPANIES = [
  {
    name: "СДЭК",
    logo: "📦",
    time: "1–5 дней",
    desc: "Доставка до пункта выдачи или курьером до двери по всей России",
    popular: true,
  },
  {
    name: "ПЭК",
    logo: "🚛",
    time: "2–7 дней",
    desc: "Грузовая доставка, подходит для крупных и тяжёлых запчастей",
    popular: false,
  },
  {
    name: "Деловые Линии",
    logo: "🏭",
    time: "2–6 дней",
    desc: "Надёжная доставка по крупным городам и региональным центрам",
    popular: false,
  },
  {
    name: "Почта России",
    logo: "✉️",
    time: "5–14 дней",
    desc: "Доставка в труднодоступные районы и небольшие населённые пункты",
    popular: false,
  },
];

const HOW_IT_WORKS = [
  {
    n: "01",
    title: "Оформите заказ",
    desc: "Выберите запчасти в каталоге или оставьте запрос по VIN-коду",
  },
  {
    n: "02",
    title: "Подтверждение",
    desc: "Менеджер свяжется с вами, уточнит детали и стоимость доставки",
  },
  {
    n: "03",
    title: "Отправка",
    desc: "Упакуем и передадим в транспортную компанию или оставим для самовывоза",
  },
  {
    n: "04",
    title: "Получение",
    desc: "Заберите заказ в пункте выдачи или встретьте курьера",
  },
];

const IMPORTANT = [
  "Хрупкие детали упаковываем с защитным материалом",
  "К каждому заказу прилагается накладная и чек",
  "Крупногабаритный товар отправляем только транспортными компаниями",
  "Стоимость доставки рассчитывается индивидуально по весу и габаритам",
  "Застрахуем отправление по вашему желанию",
];

export default function DeliveryPage() {
  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Hero */}
      <section className="relative overflow-hidden py-16 md:py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-600/12 via-neutral-950 to-neutral-950" />
        <div className="absolute top-10 right-20 w-72 h-72 bg-orange-500/8 rounded-full blur-3xl pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="flex items-center gap-2 text-neutral-500 text-sm mb-6">
            <Link href="/" className="hover:text-orange-500 transition-colors">Главная</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-neutral-300">Доставка</span>
          </div>

          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Доставка</h1>
            <p className="text-lg text-neutral-400">
              Самовывоз в Екатеринбурге или доставка транспортной компанией в любой город России
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 pb-20">
        <div className="max-w-5xl mx-auto space-y-10">

          {/* Екатеринбург */}
          <section>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-orange-500/20 rounded-xl flex items-center justify-center shrink-0">
                <MapPin className="h-4 w-4 text-orange-500" />
              </div>
              <h2 className="text-2xl font-bold text-white">Екатеринбург</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {EKATERINBURG_OPTIONS.map((opt) => (
                <Card key={opt.title} className="border-neutral-800 bg-neutral-900 hover:border-orange-500/40 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-11 h-11 bg-orange-500/15 rounded-xl flex items-center justify-center shrink-0">
                        {opt.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <p className="font-semibold text-white">{opt.title}</p>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${opt.badgeColor}`}>
                            {opt.badge}
                          </span>
                        </div>
                        <p className="text-neutral-400 text-sm mb-1">{opt.desc}</p>
                        <p className="text-neutral-500 text-xs flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          {opt.detail}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Вся Россия */}
          <section>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-orange-500/20 rounded-xl flex items-center justify-center shrink-0">
                <Globe className="h-4 w-4 text-orange-500" />
              </div>
              <h2 className="text-2xl font-bold text-white">Вся Россия</h2>
            </div>

            <p className="text-neutral-400 mb-5">
              Отправляем запчасти по всей России через проверенные транспортные компании.
              Выбор перевозчика зависит от вашего региона, веса и габаритов заказа.
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              {TRANSPORT_COMPANIES.map((tc) => (
                <Card
                  key={tc.name}
                  className={`border-neutral-800 bg-neutral-900 hover:border-orange-500/40 transition-colors ${
                    tc.popular ? "ring-1 ring-orange-500/30" : ""
                  }`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl shrink-0">{tc.logo}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="font-semibold text-white">{tc.name}</p>
                          {tc.popular && (
                            <span className="text-[11px] text-orange-400 bg-orange-500/10 rounded-full px-2 py-0.5 font-medium">
                              Популярный
                            </span>
                          )}
                        </div>
                        <p className="text-neutral-400 text-xs leading-relaxed mb-2">{tc.desc}</p>
                        <p className="text-orange-500 text-xs font-medium flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {tc.time}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-orange-500/20 bg-orange-500/5 mt-4">
              <CardContent className="p-5">
                <p className="text-sm text-neutral-300 leading-relaxed">
                  <span className="font-semibold text-orange-400">Важно:</span> стоимость и сроки доставки
                  рассчитываются индивидуально после подтверждения заказа — зависят от веса, габаритов
                  и вашего региона. Уточняйте у менеджера.
                </p>
              </CardContent>
            </Card>
          </section>

          {/* Как это работает */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-5">Как оформить доставку</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {HOW_IT_WORKS.map((step, i) => (
                <div key={step.n} className="relative">
                  <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 h-full hover:border-orange-500/40 transition-colors">
                    <div className="text-4xl font-bold text-orange-500/20 mb-3">{step.n}</div>
                    <p className="font-semibold text-white text-sm mb-1.5">{step.title}</p>
                    <p className="text-neutral-400 text-xs leading-relaxed">{step.desc}</p>
                  </div>
                  {i < HOW_IT_WORKS.length - 1 && (
                    <div className="hidden lg:flex absolute top-1/2 -right-2 z-10">
                      <ChevronRight className="h-4 w-4 text-neutral-700" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Важная информация */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-5">Упаковка и отправка</h2>
            <Card className="border-neutral-800 bg-neutral-900">
              <CardContent className="p-6">
                <ul className="space-y-3">
                  {IMPORTANT.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-neutral-300">
                      <CheckCircle2 className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </section>

          {/* CTA */}
          <Card className="border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-orange-600/5">
            <CardContent className="p-8 md:p-10">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-white mb-2">Остались вопросы по доставке?</h3>
                  <p className="text-neutral-400">
                    Позвоните нам — уточним сроки, стоимость и выберем удобный способ доставки для вашего заказа
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                  <a href="tel:+79326006015">
                    <Button size="lg" className="gap-2 w-full sm:w-auto">
                      <Phone className="h-4 w-4" />
                      Позвонить
                    </Button>
                  </a>
                  <Link href="/contacts">
                    <Button size="lg" variant="outline" className="gap-2 w-full sm:w-auto">
                      Все контакты
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
