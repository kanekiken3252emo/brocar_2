import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Политика конфиденциальности",
  description: "Политика конфиденциальности BroCar",
};

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-4xl font-bold">Политика конфиденциальности</h1>

        <Card>
          <CardHeader>
            <CardTitle>1. Общие положения</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Настоящая Политика конфиденциальности определяет порядок обработки
              и защиты персональных данных пользователей сайта BroCar.
            </p>
            <p>
              Используя наш сайт, вы соглашаетесь с условиями настоящей Политики
              конфиденциальности.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Сбор персональных данных</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Мы можем собирать следующую информацию:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Имя и фамилия</li>
              <li>Контактная информация (email, телефон)</li>
              <li>Адрес доставки</li>
              <li>История заказов</li>
              <li>IP-адрес и данные cookie</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. Использование персональных данных</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Собранная информация используется для:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Обработки и выполнения заказов</li>
              <li>Связи с клиентами</li>
              <li>Улучшения качества обслуживания</li>
              <li>Отправки информационных материалов (с вашего согласия)</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. Защита данных</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Мы предпринимаем все необходимые меры для защиты ваших
              персональных данных от несанкционированного доступа, изменения или
              раскрытия.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>5. Контакты</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              По вопросам, связанным с обработкой персональных данных,
              обращайтесь: info@brocar.ru
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




