import { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ArrowRight, Phone, BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getGuidesByCategory, isGuideReady } from "@/lib/guides";
import { guideIcon } from "./_icons";

export const metadata: Metadata = {
  title: "Помощь с выбором",
  description:
    "Гайды по подбору автозапчастей: как выбрать моторное масло, тормозные колодки, аккумулятор и другое — BroCar.",
};

export default function GuidesPage() {
  const groups = getGuidesByCategory();

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Hero */}
      <section className="relative overflow-hidden py-8 md:py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-600/12 via-neutral-950 to-neutral-950" />
        <div className="absolute top-10 right-20 w-72 h-72 bg-orange-500/8 rounded-full blur-3xl pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="flex items-center justify-center gap-2 text-neutral-500 text-sm mb-6">
            <Link href="/" className="hover:text-orange-500 transition-colors">
              Главная
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-neutral-300">Помощь с выбором</span>
          </div>

          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 border border-orange-500/30 rounded-full text-orange-400 text-xs md:text-sm mb-4">
              <BookOpen className="h-4 w-4" />
              Гайды и советы
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Помощь с выбором
            </h1>
            <p className="text-lg text-neutral-400">
              Короткие понятные статьи: как подобрать лампы, щётки, антифриз и
              тормозную жидкость, не переплачивая и не ошибаясь.
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 pb-20">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups
              .flatMap((group) => group.guides)
              .map((g) => {
                const Icon = guideIcon(g.icon);
                const ready = isGuideReady(g);
                return (
                  <Link
                    key={g.slug}
                    href={`/guides/${g.slug}`}
                    className="group block"
                  >
                    <Card className="border-neutral-800 bg-neutral-900 hover:border-orange-500/40 transition-colors h-full">
                      <CardContent className="p-5 flex flex-col h-full">
                        <div className="flex items-center justify-between mb-3">
                          <div className="w-11 h-11 bg-orange-500/15 rounded-xl flex items-center justify-center shrink-0">
                            <Icon className="h-5 w-5 text-orange-500" />
                          </div>
                          {!ready && (
                            <span className="text-[11px] font-medium text-neutral-400 bg-neutral-800 rounded-full px-2 py-0.5">
                              Скоро
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-white mb-1.5 group-hover:text-orange-400 transition-colors">
                          {g.title}
                        </h3>
                        <p className="text-neutral-400 text-sm leading-relaxed flex-1">
                          {g.excerpt}
                        </p>
                        <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-orange-500 group-hover:gap-2 transition-all">
                          Читать
                          <ArrowRight className="h-4 w-4" />
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
          </div>

          {/* CTA */}
          <Card className="border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-orange-600/5">
            <CardContent className="p-8 md:p-10">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-white mb-2">
                    Не нашли ответ на свой вопрос?
                  </h3>
                  <p className="text-neutral-400">
                    Позвоните нам — поможем подобрать нужную запчасть по марке,
                    модели или VIN-коду.
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
                    <Button
                      size="lg"
                      variant="outline"
                      className="gap-2 w-full sm:w-auto"
                    >
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
