import type { Metadata } from "next";
import Link from "next/link";
import {
  Car,
  ChevronRight,
  Search,
  Layers,
  ShieldCheck,
  Phone,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VinCatalog } from "@/components/goodvin/VinCatalog";

export const metadata: Metadata = {
  // « | BroCar» допишет шаблон лейаута — бренд вручную не дублируем.
  title: "Онлайн-каталог запчастей по VIN для 400+ марок",
  description:
    "Подбор оригинальных запчастей по VIN, марке и модели авто онлайн: 400+ марок, схемы узлов и OEM-номера. Найдите деталь и закажите в BroCar с доставкой!",
};

const FEATURES = [
  {
    icon: <Search className="h-5 w-5" />,
    title: "Поиск по VIN, марке и модели",
    description:
      "Введите 17-значный VIN или выберите марку — каталог покажет схемы узлов и точные номера деталей.",
  },
  {
    icon: <Layers className="h-5 w-5" />,
    title: "400+ марок",
    description:
      "Легковые, грузовые, автобусы, спецтехника, мото и двигатели. Регулярное обновление базы.",
  },
  {
    icon: <ShieldCheck className="h-5 w-5" />,
    title: "Оригинальные номера",
    description:
      "OEM-артикулы, изображения деталей, применимость к комплектации — без ошибок при заказе.",
  },
];

/** Преимущества + блок помощи. Общий низ для lean- и полного режимов. */
function CatalogExtras() {
  return (
    <>
      <div className="grid lg:grid-cols-3 gap-4">
        {FEATURES.map((feature) => (
          <Card key={feature.title} className="border-neutral-800 bg-neutral-900">
            <CardContent className="p-5 flex gap-4">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/20 flex items-center justify-center text-orange-500">
                {feature.icon}
              </div>
              <div>
                <p className="font-semibold text-white text-sm mb-1">
                  {feature.title}
                </p>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-neutral-800 bg-neutral-900 mt-6">
        <CardContent className="p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-white text-base mb-1 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-orange-500" />
                Не нашли деталь или нужна помощь?
              </p>
              <p className="text-neutral-400 text-sm">
                Оставьте VIN — наш менеджер подберёт запчасть и сообщит наличие и
                цены у поставщиков.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Link href="/vin-search">
                <Button className="gap-2">
                  <Search className="h-4 w-4" />
                  Запрос менеджеру
                </Button>
              </Link>
              <a href="tel:+79326006015">
                <Button variant="outline" className="gap-2">
                  <Phone className="h-4 w-4" />
                  Позвонить
                </Button>
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export default async function CatalogVinPage({
  searchParams,
}: {
  searchParams: Promise<{ vin?: string | string[] }>;
}) {
  const sp = await searchParams;
  const vinRaw = Array.isArray(sp.vin) ? sp.vin[0] : sp.vin;
  const vin = vinRaw?.trim() || undefined;

  // Заход с VIN (из верхней строки поиска или гаража) — сразу рабочий каталог
  // без лендинга: ни заголовка-приглашения, ни блоков-фич, ни дубля поиска.
  if (vin) {
    return (
      <div className="min-h-screen bg-neutral-950">
        <div className="container mx-auto px-4 py-5 md:py-8">
          <div className="flex items-center gap-2 text-neutral-500 text-sm mb-4">
            <Link href="/" className="hover:text-orange-500 transition-colors">
              Главная
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link
              href="/catalog-vin"
              className="hover:text-orange-500 transition-colors"
            >
              Каталог по VIN
            </Link>
          </div>
          <Card className="border-neutral-800 bg-neutral-900">
            <CardContent className="p-4 md:p-6">
              <VinCatalog initialVin={vin} />
            </CardContent>
          </Card>

          <div className="mt-8 md:mt-10">
            <CatalogExtras />
          </div>
        </div>
      </div>
    );
  }

  // Прямой заход без VIN — полноценный лендинг с приглашением.
  return (
    <div className="min-h-screen bg-neutral-950">
      <section className="relative overflow-hidden py-6 md:py-16">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-600/15 via-neutral-950 to-neutral-950" />
        <div className="absolute top-10 right-20 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none hidden md:block" />
        <div className="absolute bottom-0 left-10 w-48 h-48 bg-orange-500/5 rounded-full blur-2xl pointer-events-none hidden md:block" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="flex items-center gap-2 text-neutral-500 text-sm mb-4 md:mb-6">
            <Link href="/" className="hover:text-orange-500 transition-colors">
              Главная
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-neutral-300">Каталог по VIN</span>
          </div>

          <div className="max-w-3xl">
            <div className="hidden md:inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-1.5 mb-5">
              <Car className="h-4 w-4 text-orange-500" />
              <span className="text-orange-400 text-sm font-medium">
                Онлайн-каталог
              </span>
            </div>

            <h1 className="text-2xl md:text-5xl font-bold text-white mb-2 md:mb-4 leading-tight">
              Каталог запчастей{" "}
              <span className="text-orange-500">по VIN</span>
            </h1>
            <p className="text-sm md:text-lg text-neutral-400 max-w-2xl">
              Найдите нужную деталь самостоятельно: введите VIN-код или выберите
              марку и модель. Каталог откроет схемы узлов с оригинальными
              номерами производителя.
            </p>
          </div>
        </div>
      </section>

      {/* Собственный каталог на Catalogs API GoodVin: VIN → авто → узлы →
          детали, в дизайне сайта. OEM-номера деталей ведут в наш поиск цен. */}
      <div className="container mx-auto px-4 -mt-2 md:-mt-6 mb-10 md:mb-14">
        <Card className="border-neutral-800 bg-neutral-900">
          <CardContent className="p-4 md:p-6">
            <VinCatalog />
          </CardContent>
        </Card>
      </div>

      <div className="container mx-auto px-4 pb-16">
        <CatalogExtras />
      </div>
    </div>
  );
}
