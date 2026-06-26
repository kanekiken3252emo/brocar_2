import { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  CreditCard,
  ChevronRight,
  Banknote,
  Phone,
  MessageCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  Smartphone,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Оплата",
  description: "Условия и способы оплаты автозапчастей — BroCar",
};

const PAYMENT_METHODS = [
  {
    icon: <Smartphone className="h-5 w-5 text-orange-500" />,
    title: "Онлайн картой и через СБП",
    desc: "Оплата банковской картой или через Систему быстрых платежей (СБП) прямо на сайте при оформлении заказа",
    detail: "Visa · Mastercard · МИР · СБП",
    badge: "Скоро",
    badgeColor: "text-orange-400 bg-orange-500/10",
  },
  {
    icon: <Banknote className="h-5 w-5 text-orange-500" />,
    title: "Наличными в офисе",
    desc: "Оплата при самовывозе в нашем офисе по адресу: Екатеринбург, ул. Заводская, 16",
    detail: "Пн — Пт: 10:00 — 19:00, Сб: 10:00 — 15:00",
    badge: "Доступно сейчас",
    badgeColor: "text-neutral-300 bg-neutral-500/10",
  },
  {
    icon: <CreditCard className="h-5 w-5 text-orange-500" />,
    title: "Безналичный расчёт для юрлиц",
    desc: "Оплата по счёту на расчётный счёт — реквизиты указаны на странице «Реквизиты» или предоставит менеджер",
    detail: "Возможна оплата с НДС",
    badge: "Для юрлиц",
    badgeColor: "text-neutral-400 bg-neutral-500/10",
  },
];

const HOW_IT_WORKS = [
  {
    n: "01",
    title: "Оставьте заказ",
    desc: "Выберите товар в каталоге или отправьте запрос по VIN-коду через форму на сайте",
  },
  {
    n: "02",
    title: "Подтверждение",
    desc: "Менеджер свяжется с вами, уточнит наличие, стоимость и удобный способ оплаты",
  },
  {
    n: "03",
    title: "Оплата",
    desc: "Оплачиваете удобным способом: онлайн картой или через СБП, наличными в офисе либо по счёту",
  },
  {
    n: "04",
    title: "Получение",
    desc: "Забираете заказ при самовывозе или отправляем транспортной компанией после оплаты",
  },
];

const NOTES = [
  "Онлайн-оплата картой и через СБП проходит в защищённой форме при оформлении заказа",
  "Для юридических лиц возможна оплата по счёту с НДС — уточняйте у менеджера",
  "Предоплата для иногородних клиентов при отправке транспортной компанией",
  "Возврат средств при отказе от заказа — по договорённости с менеджером",
];

export default function PaymentPage() {
  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Hero */}
      <section className="relative overflow-hidden py-8 md:py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-600/12 via-neutral-950 to-neutral-950" />
        <div className="absolute top-10 right-20 w-72 h-72 bg-orange-500/8 rounded-full blur-3xl pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="flex items-center gap-2 text-neutral-500 text-sm mb-6">
            <Link href="/" className="hover:text-orange-500 transition-colors">Главная</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-neutral-300">Оплата</span>
          </div>

          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Оплата</h1>
            <p className="text-lg text-neutral-400">
              Выберите удобный способ оплаты — онлайн картой и через СБП, наличными в офисе или по счёту для юрлиц
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 pb-20">
        <div className="max-w-5xl mx-auto space-y-10">

          {/* Важное уведомление */}
          <Card className="border-orange-500/30 bg-orange-500/5">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                  <ClipboardList className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="font-semibold text-white mb-1.5">Как происходит оплата</p>
                  <p className="text-neutral-300 text-sm leading-relaxed">
                    Оплатить заказ можно онлайн — банковской картой или через СБП прямо на сайте при
                    оформлении, наличными при самовывозе в офисе, а для юридических лиц — по счёту.
                    Если останутся вопросы, наш менеджер свяжется с вами и поможет выбрать удобный вариант.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Способы оплаты */}
          <section>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-orange-500/20 rounded-xl flex items-center justify-center shrink-0">
                <CreditCard className="h-4 w-4 text-orange-500" />
              </div>
              <h2 className="text-2xl font-bold text-white">Способы оплаты</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {PAYMENT_METHODS.map((method) => (
                <Card key={method.title} className="border-neutral-800 bg-neutral-900 hover:border-orange-500/40 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-11 h-11 bg-orange-500/15 rounded-xl flex items-center justify-center shrink-0">
                        {method.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <p className="font-semibold text-white">{method.title}</p>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${method.badgeColor}`}>
                            {method.badge}
                          </span>
                        </div>
                        <p className="text-neutral-400 text-sm mb-1">{method.desc}</p>
                        <p className="text-neutral-500 text-xs flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          {method.detail}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Как это работает */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-5">Порядок оформления и оплаты</h2>
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

          {/* Примечания */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-5">Важная информация</h2>
            <Card className="border-neutral-800 bg-neutral-900">
              <CardContent className="p-6">
                <ul className="space-y-3">
                  {NOTES.map((note) => (
                    <li key={note} className="flex items-start gap-3 text-sm text-neutral-300">
                      <CheckCircle2 className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                      {note}
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
                  <h3 className="text-2xl font-bold text-white mb-2">Есть вопросы по оплате?</h3>
                  <p className="text-neutral-400">
                    Позвоните или напишите нам — менеджер расскажет об удобном для вас варианте оплаты
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                  <a href="tel:+79326006015">
                    <Button size="lg" className="gap-2 w-full sm:w-auto">
                      <Phone className="h-4 w-4" />
                      Позвонить
                    </Button>
                  </a>
                  <a href="https://t.me/+79326006015" target="_blank" rel="noopener noreferrer">
                    <Button size="lg" variant="outline" className="gap-2 w-full sm:w-auto">
                      <MessageCircle className="h-4 w-4" />
                      Telegram
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
