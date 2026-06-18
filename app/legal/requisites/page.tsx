import { Card, CardContent } from "@/components/ui/card";
import { Metadata } from "next";
import { Building2, ArrowLeft, Phone, Mail, MapPin, Landmark } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Реквизиты",
  description:
    "Реквизиты ИП Бакиров Артём Олегович (BroCar) — ИНН, ОГРНИП, юридический адрес и банковские реквизиты для безналичной оплаты.",
};

const LEGAL = [
  { label: "Полное наименование", value: "Индивидуальный предприниматель Бакиров Артём Олегович" },
  { label: "Сокращённое наименование", value: "ИП Бакиров Артём Олегович" },
  { label: "ИНН", value: "660308104039" },
  { label: "ОГРНИП", value: "324665800095141" },
];

const BANK = [
  { label: "Расчётный счёт", value: "40802810716540423011" },
  { label: "Корр. счёт", value: "30101810500000000674" },
  { label: "БИК банка", value: "046577674" },
  { label: "Банк", value: "Уральский банк ПАО Сбербанк, г. Екатеринбург" },
];

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-6 border-b border-neutral-800 last:border-0">
      <dt className="text-sm text-neutral-500 sm:w-56 sm:shrink-0">{label}</dt>
      <dd className="text-sm md:text-base text-neutral-100 font-medium leading-relaxed">
        {value}
      </dd>
    </div>
  );
}

export default function RequisitesPage() {
  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/"
              className="inline-flex items-center text-orange-500 hover:text-orange-400 mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              На главную
            </Link>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center shrink-0">
                <Building2 className="h-6 w-6 text-orange-500" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white">Реквизиты</h1>
            </div>
            <p className="text-neutral-400">
              Реквизиты продавца для договоров, счетов и безналичной оплаты
            </p>
          </div>

          {/* Юридические данные */}
          <Card className="border-neutral-800 bg-neutral-900 mb-6">
            <CardContent className="p-6 md:p-8">
              <h2 className="text-lg font-semibold text-white mb-2">
                Сведения об индивидуальном предпринимателе
              </h2>
              <dl className="mt-2">
                {LEGAL.map((row) => (
                  <Row key={row.label} label={row.label} value={row.value} />
                ))}
              </dl>
            </CardContent>
          </Card>

          {/* Банковские реквизиты */}
          <Card className="border-neutral-800 bg-neutral-900 mb-6">
            <CardContent className="p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <Landmark className="h-5 w-5 text-orange-500 shrink-0" />
                <h2 className="text-lg font-semibold text-white">Банковские реквизиты</h2>
              </div>
              <dl>
                {BANK.map((row) => (
                  <Row key={row.label} label={row.label} value={row.value} />
                ))}
              </dl>
            </CardContent>
          </Card>

          {/* Контакты */}
          <Card className="border-neutral-800 bg-neutral-900">
            <CardContent className="p-6 md:p-8">
              <h2 className="text-lg font-semibold text-white mb-4">Контакты</h2>
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:gap-8">
                <a
                  href="tel:+79326006015"
                  className="inline-flex items-center gap-2 text-neutral-200 hover:text-orange-400 transition-colors"
                >
                  <Phone className="h-4 w-4 text-orange-500 shrink-0" />
                  +7 932 600 60 15
                </a>
                <a
                  href="tel:+73433822062"
                  className="inline-flex items-center gap-2 text-neutral-200 hover:text-orange-400 transition-colors"
                >
                  <Phone className="h-4 w-4 text-orange-500 shrink-0" />
                  8 343 382 20 62
                </a>
                <a
                  href="mailto:info@brocarparts.ru"
                  className="inline-flex items-center gap-2 text-neutral-200 hover:text-orange-400 transition-colors"
                >
                  <Mail className="h-4 w-4 text-orange-500 shrink-0" />
                  info@brocarparts.ru
                </a>
                <span className="inline-flex items-start gap-2 text-neutral-400">
                  <MapPin className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                  г. Екатеринбург, ул. Заводская, 16
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
