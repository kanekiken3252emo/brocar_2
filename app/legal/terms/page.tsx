import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Условия использования",
  description: "Условия использования сайта BroCar",
};

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-4xl font-bold">Условия использования</h1>

        <Card>
          <CardHeader>
            <CardTitle>1. Принятие условий</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Используя сайт BroCar, вы соглашаетесь с настоящими Условиями
              использования. Если вы не согласны с какими-либо условиями,
              пожалуйста, не используйте наш сайт.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Использование сайта</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Вы обязуетесь:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Предоставлять точную и актуальную информацию</li>
              <li>Не использовать сайт в незаконных целях</li>
              <li>Не нарушать права других пользователей</li>
              <li>Соблюдать авторские права и права интеллектуальной собственности</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. Заказы и оплата</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Оформляя заказ на нашем сайте, вы подтверждаете свое намерение
              приобрести товары и согласие оплатить их стоимость.
            </p>
            <p>
              Цены на товары указаны в российских рублях и могут быть изменены
              без предварительного уведомления.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. Возврат и гарантии</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Возврат товара возможен в течение 14 дней с момента получения при
              условии сохранения товарного вида и упаковки.
            </p>
            <p>
              На все товары распространяется гарантия производителя в
              соответствии с законодательством РФ.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>5. Ограничение ответственности</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Компания не несет ответственности за косвенные убытки,
              возникшие в результате использования или невозможности
              использования сайта.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>6. Изменения условий</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              Мы оставляем за собой право изменять настоящие Условия
              использования в любое время. Изменения вступают в силу с момента
              публикации на сайте.
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




