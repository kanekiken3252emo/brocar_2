import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Использование Cookie",
  description: "Политика использования cookie-файлов на сайте BroCar",
};

export default function CookiesPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-4xl font-bold">Политика использования Cookie</h1>

        <Card>
          <CardHeader>
            <CardTitle>Что такое cookie?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Cookie (куки) — это небольшие текстовые файлы, которые сохраняются
              на вашем устройстве при посещении веб-сайтов. Они помогают сайту
              запомнить информацию о вашем визите.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Какие cookie мы используем</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Обязательные cookie</h3>
              <p className="text-gray-600">
                Необходимы для работы основных функций сайта, таких как
                авторизация и корзина покупок.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Аналитические cookie</h3>
              <p className="text-gray-600">
                Помогают нам понять, как посетители используют наш сайт, чтобы
                улучшить его работу.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Функциональные cookie</h3>
              <p className="text-gray-600">
                Запоминают ваши предпочтения (например, язык интерфейса) для
                более удобного использования сайта.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Управление cookie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Вы можете контролировать и/или удалять cookie по своему усмотрению.
              Подробности можно узнать на сайте{" "}
              <a
                href="https://www.aboutcookies.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                aboutcookies.org
              </a>
              .
            </p>
            <p>
              Вы можете удалить все cookie, сохраненные на вашем компьютере, а
              также настроить большинство браузеров на блокировку их установки.
              Однако в этом случае вам, возможно, придется самостоятельно
              настраивать некоторые параметры при каждом посещении сайта, и
              некоторые функции могут не работать.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Согласие на использование cookie</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              Продолжая использовать наш сайт, вы соглашаетесь с использованием
              cookie в соответствии с настоящей Политикой.
            </p>
          </CardContent>
        </Card>

        <p className="text-sm text-gray-600">
          Последнее обновление: {new Date().toLocaleDateString("ru-RU")}
        </p>
      </div>
    </div>
  );
}




