import { Card, CardContent } from "@/components/ui/card";
import { Metadata } from "next";
import { Cookie, ArrowLeft } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Политика использования файлов cookie",
  description: "Политика использования файлов cookie на сайте BroCar.",
};

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
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
                <Cookie className="h-6 w-6 text-orange-500" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white">
                Политика использования файлов cookie
              </h1>
            </div>
            <p className="text-neutral-400">Последнее обновление: 27 июня 2026 г.</p>
          </div>

          <Card className="border-neutral-800 bg-neutral-900">
            <CardContent className="p-6 md:p-8 prose prose-invert max-w-none text-neutral-300 leading-relaxed [&_h2]:text-white [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-white [&_h3]:text-lg [&_h3]:font-medium [&_h3]:mt-5 [&_h3]:mb-2 [&_p]:mb-4">
              <h2>Что такое cookie</h2>
              <p>
                Cookie — это небольшие текстовые файлы, которые сохраняются на
                вашем устройстве при посещении сайта{" "}
                <a
                  href="https://brocarparts.ru"
                  className="text-orange-500 hover:text-orange-400"
                >
                  brocarparts.ru
                </a>{" "}
                и помогают сайту работать корректно и удобно.
              </p>

              <h2>Какие cookie мы используем</h2>

              <h3>Необходимые</h3>
              <p>
                Обеспечивают базовую работу сайта: авторизацию, сессию, корзину.
                Без них сайт не функционирует, поэтому отдельного согласия они не
                требуют.
              </p>

              <h3>Функциональные</h3>
              <p>
                Запоминают ваши предпочтения (например, регион) для удобства.
              </p>

              <h3>Аналитические</h3>
              <p>
                Помогают понять, как посетители используют сайт, чтобы улучшать
                его. Применяются на территории РФ.
              </p>

              <h2>Cookie и персональные данные</h2>
              <p>
                Если cookie позволяют идентифицировать пользователя, содержащиеся в
                них данные обрабатываются в соответствии с{" "}
                <Link
                  href="/legal/privacy"
                  className="text-orange-500 hover:text-orange-400"
                >
                  Политикой обработки персональных данных
                </Link>{" "}
                и{" "}
                <Link
                  href="/legal/consent"
                  className="text-orange-500 hover:text-orange-400"
                >
                  Согласием на обработку ПДн
                </Link>
                . Все данные хранятся в Российской Федерации, трансграничная
                передача не осуществляется.
              </p>

              <h2>Управление cookie</h2>
              <p>
                Вы можете ограничить или удалить cookie через настройки браузера.
                Отключение необходимых cookie может повлиять на работу сайта.
                Продолжая пользоваться сайтом, вы соглашаетесь с использованием
                cookie на условиях настоящей Политики.
              </p>

              <h2>Контакты</h2>
              <p>
                По вопросам, связанным с cookie:{" "}
                <a
                  href="mailto:info@brocarparts.ru"
                  className="text-orange-500 hover:text-orange-400"
                >
                  info@brocarparts.ru
                </a>
                .
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
