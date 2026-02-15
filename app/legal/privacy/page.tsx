import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Metadata } from "next";
import { Shield, ArrowLeft } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Политика конфиденциальности",
  description: "Политика конфиденциальности BroCar",
};

export default function PrivacyPage() {
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
                <Shield className="h-6 w-6 text-orange-500" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white">
                Политика конфиденциальности
              </h1>
            </div>
            <p className="text-neutral-400">
              Последнее обновление: Январь 2026
            </p>
          </div>

          <Card className="border-neutral-800 bg-neutral-900">
            <CardContent className="p-8 prose prose-invert max-w-none">
              <h2 className="text-xl font-semibold text-white mb-4">1. Общие положения</h2>
              <p className="text-neutral-400 mb-6">
                Настоящая Политика конфиденциальности определяет порядок обработки и защиты 
                персональных данных пользователей сайта BroCar.
              </p>

              <h2 className="text-xl font-semibold text-white mb-4">2. Сбор информации</h2>
              <p className="text-neutral-400 mb-6">
                Мы собираем информацию, которую вы предоставляете при регистрации, 
                оформлении заказов и использовании нашего сайта:
              </p>
              <ul className="list-disc list-inside text-neutral-400 mb-6 space-y-2">
                <li>Контактные данные (имя, email, телефон)</li>
                <li>Адрес доставки</li>
                <li>История заказов</li>
                <li>Данные об использовании сайта</li>
              </ul>

              <h2 className="text-xl font-semibold text-white mb-4">3. Использование данных</h2>
              <p className="text-neutral-400 mb-6">
                Собранные данные используются для:
              </p>
              <ul className="list-disc list-inside text-neutral-400 mb-6 space-y-2">
                <li>Обработки и доставки заказов</li>
                <li>Связи с вами по вопросам заказов</li>
                <li>Улучшения качества сервиса</li>
                <li>Отправки информационных сообщений (при вашем согласии)</li>
              </ul>

              <h2 className="text-xl font-semibold text-white mb-4">4. Защита данных</h2>
              <p className="text-neutral-400 mb-6">
                Мы применяем современные методы защиты информации, включая шифрование 
                и безопасные протоколы передачи данных.
              </p>

              <h2 className="text-xl font-semibold text-white mb-4">5. Контакты</h2>
              <p className="text-neutral-400">
                По вопросам, связанным с обработкой персональных данных, 
                вы можете связаться с нами по email: <a href="mailto:privacy@brocar.ru" className="text-orange-500 hover:text-orange-400">privacy@brocar.ru</a>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
