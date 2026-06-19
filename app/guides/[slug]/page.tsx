import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  Clock,
  Lightbulb,
  Phone,
  Hammer,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  GUIDES,
  getGuide,
  isGuideReady,
  type GuideBlock,
} from "@/lib/guides";
import { guideIcon } from "../_icons";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return { title: "Статья не найдена" };
  return {
    title: guide.title,
    description: guide.excerpt,
  };
}

function Block({ block }: { block: GuideBlock }) {
  switch (block.type) {
    case "heading":
      return (
        <h2 className="text-xl md:text-2xl font-bold text-white mt-8 mb-3">
          {block.text}
        </h2>
      );
    case "paragraph":
      return (
        <p className="text-neutral-300 leading-relaxed mb-4">{block.text}</p>
      );
    case "list":
      return block.ordered ? (
        <ol className="list-decimal list-outside pl-5 space-y-2 mb-4 text-neutral-300 marker:text-orange-500 marker:font-semibold">
          {block.items.map((it, i) => (
            <li key={i} className="leading-relaxed pl-1">
              {it}
            </li>
          ))}
        </ol>
      ) : (
        <ul className="space-y-2 mb-4">
          {block.items.map((it, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-neutral-300 leading-relaxed"
            >
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0" />
              {it}
            </li>
          ))}
        </ul>
      );
    case "tip":
      return (
        <Card className="border-orange-500/20 bg-orange-500/5 my-5">
          <CardContent className="p-4 md:p-5 flex items-start gap-3">
            <Lightbulb className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
            <p className="text-sm text-neutral-300 leading-relaxed">
              {block.text}
            </p>
          </CardContent>
        </Card>
      );
    case "slogan":
      return (
        <p className="text-center text-lg md:text-xl font-bold text-orange-500 mt-10 mb-2">
          {block.text}
        </p>
      );
  }
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const Icon = guideIcon(guide.icon);
  const ready = isGuideReady(guide);

  // Другие статьи из той же категории (до 3) — для блока «Читайте также».
  const related = GUIDES.filter(
    (g) => g.category === guide.category && g.slug !== guide.slug
  ).slice(0, 3);

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="max-w-3xl mx-auto">
          {/* Хлебные крошки */}
          <div className="flex items-center gap-2 text-neutral-500 text-sm mb-6 flex-wrap">
            <Link href="/" className="hover:text-orange-500 transition-colors">
              Главная
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link
              href="/guides"
              className="hover:text-orange-500 transition-colors"
            >
              Помощь с выбором
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-neutral-300">{guide.title}</span>
          </div>

          {/* Заголовок */}
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 bg-orange-500/15 rounded-xl flex items-center justify-center shrink-0">
              <Icon className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <span className="text-orange-500 text-sm font-medium">
                {guide.category}
              </span>
              <h1 className="text-3xl md:text-4xl font-bold text-white mt-0.5">
                {guide.title}
              </h1>
            </div>
          </div>

          {ready && guide.readingMinutes && (
            <div className="flex items-center gap-1.5 text-neutral-500 text-sm mb-8">
              <Clock className="h-4 w-4" />
              {guide.readingMinutes} мин чтения
            </div>
          )}

          {/* Контент */}
          {ready ? (
            <article className="mb-10">
              {guide.blocks.map((block, i) => (
                <Block key={i} block={block} />
              ))}
            </article>
          ) : (
            <Card className="border-neutral-800 bg-neutral-900 mb-10">
              <CardContent className="p-8 text-center">
                <div className="w-14 h-14 bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Hammer className="h-6 w-6 text-neutral-500" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">
                  Материал готовится
                </h2>
                <p className="text-neutral-400 max-w-md mx-auto">
                  Мы уже пишем эту статью. А пока — позвоните нам, и менеджер
                  поможет с выбором.
                </p>
              </CardContent>
            </Card>
          )}

          {/* CTA в каталог */}
          {guide.categorySlug && (
            <Card className="border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-orange-600/5 mb-10">
              <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center gap-4">
                <p className="text-neutral-200 font-medium flex-1">
                  Готовы выбрать? Посмотрите подходящие товары в каталоге.
                </p>
                <Link href={`/catalog?category=${guide.categorySlug}`}>
                  <Button className="gap-2 w-full sm:w-auto">
                    Перейти в каталог
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Контакт */}
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-between bg-neutral-900 border border-neutral-800 rounded-2xl p-5 mb-10">
            <p className="text-neutral-300 text-sm text-center sm:text-left">
              Остались вопросы? Поможем подобрать по марке, модели или VIN.
            </p>
            <a href="tel:+79326006015" className="shrink-0">
              <Button variant="outline" className="gap-2">
                <Phone className="h-4 w-4" />
                Позвонить
              </Button>
            </a>
          </div>

          {/* Читайте также */}
          {related.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-white mb-4">
                Читайте также
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {related.map((g) => {
                  const RIcon = guideIcon(g.icon);
                  return (
                    <Link
                      key={g.slug}
                      href={`/guides/${g.slug}`}
                      className="group flex items-center gap-3 bg-neutral-900 border border-neutral-800 hover:border-orange-500/40 rounded-xl p-4 transition-colors"
                    >
                      <div className="w-9 h-9 bg-orange-500/15 rounded-lg flex items-center justify-center shrink-0">
                        <RIcon className="h-4 w-4 text-orange-500" />
                      </div>
                      <span className="text-sm text-neutral-300 group-hover:text-orange-400 transition-colors">
                        {g.title}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Назад */}
          <Link
            href="/guides"
            className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-orange-400 transition-colors mt-10"
          >
            <ArrowLeft className="h-4 w-4" />
            Все статьи
          </Link>
        </div>
      </div>
    </div>
  );
}
