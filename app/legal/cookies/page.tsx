import { Card, CardContent } from "@/components/ui/card";
import { Metadata } from "next";
import { Cookie, ArrowLeft } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Политика Cookie",
  description: "Политика использования cookie-файлов BroCar",
};

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Link href="/" className="inline-flex items-center text-orange-500 hover:text-orange-400 mb-4 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-2" />
              На главную
            </Link>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                <Cookie className="h-6 w-6 text-orange-500" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white">
                Политика Cookie
              </h1>
            </div>
            <p className="text-neutral-400">
              Последнее обновление: Январь 2026
            </p>
          </div>

          <Card className="border-neutral-800 bg-neutral-900">
            <CardContent className="p-8 prose prose-invert max-w-none">
              <h2 className="text-xl font-semibold text-white mb-4">Что такое Cookie?</h2>
              <p className="text-neutral-400 mb-6">
                Cookie — это небольшие текстовые файлы, которые сохраняются на вашем 
                устройстве при посещении сайта. Они помогают нам улучшить работу сайта 
                и предоставить вам лучший пользовательский опыт.
              </p>

              <h2 className="text-xl font-semibold text-white mb-4">Какие Cookie мы используем?</h2>
              
              <h3 className="text-lg font-medium text-white mb-3">Необходимые Cookie</h3>
              <p className="text-neutral-400 mb-4">
                Эти Cookie необходимы для работы сайта. Они включают авторизацию, 
                корзину покупок и другие базовые функции.
              </p>

              <h3 className="text-lg font-medium text-white mb-3">Аналитические Cookie</h3>
              <p className="text-neutral-400 mb-4">
                Помогают нам понять, как посетители используют сайт, 
                чтобы улучшить его работу.
              </p>

              <h3 className="text-lg font-medium text-white mb-3">Функциональные Cookie</h3>
              <p className="text-neutral-400 mb-6">
                Запоминают ваши предпочтения (язык, регион) для удобства использования.
              </p>

              <h2 className="text-xl font-semibold text-white mb-4">Управление Cookie</h2>
              <p className="text-neutral-400 mb-6">
                Вы можете управлять Cookie через настройки браузера. 
                Обратите внимание, что отключение некоторых Cookie может повлиять 
                на функциональность сайта.
              </p>

              <h2 className="text-xl font-semibold text-white mb-4">Контакты</h2>
              <p className="text-neutral-400">
                По вопросам, связанным с Cookie, обращайтесь: <a href="mailto:privacy@brocar.ru" className="text-orange-500 hover:text-orange-400">privacy@brocar.ru</a>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
