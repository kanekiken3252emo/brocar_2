import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Metadata } from "next";
import { Mail, Phone, MapPin } from "lucide-react";

export const metadata: Metadata = {
  title: "Контакты",
  description: "Свяжитесь с нами - BroCar",
};

export default function ContactsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold">Контакты</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Phone className="mr-2 h-5 w-5" />
                Телефон
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">+7 (495) 123-45-67</p>
              <p className="text-sm text-gray-600 mt-2">
                Пн-Пт: 9:00 - 18:00 (МСК)
              </p>
              <p className="text-sm text-gray-600">
                Сб-Вс: 10:00 - 16:00 (МСК)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Mail className="mr-2 h-5 w-5" />
                Email
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">info@brocar.ru</p>
              <p className="text-sm text-gray-600 mt-2">
                Ответим в течение 24 часов
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MapPin className="mr-2 h-5 w-5" />
              Адрес
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg">
              Москва, ул. Примерная, д. 1, офис 101
            </p>
            <p className="text-gray-600 mt-2">
              Метро: Примерная станция (5 минут пешком)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Форма обратной связи</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Если у вас есть вопросы или предложения, напишите нам на{" "}
              <a
                href="mailto:info@brocar.ru"
                className="text-blue-600 hover:underline"
              >
                info@brocar.ru
              </a>
            </p>
            <p className="text-sm text-gray-500">
              Мы работаем над функцией отправки формы прямо с сайта и скоро
              добавим её.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-blue-900 mb-2">
              Режим работы склада
            </h3>
            <p className="text-blue-800">
              Понедельник - Пятница: 8:00 - 20:00
              <br />
              Суббота: 9:00 - 18:00
              <br />
              Воскресенье: выходной
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}




