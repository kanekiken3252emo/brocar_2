import { Card, CardContent } from "@/components/ui/card";
import { Metadata } from "next";
import { FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Условия использования",
  description: "Условия использования сайта BroCar",
};

export default function TermsPage() {
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
                <FileText className="h-6 w-6 text-orange-500" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white">
                Условия использования
              </h1>
            </div>
            <p className="text-neutral-400">
              Последнее обновление: Январь 2026
            </p>
          </div>

          <Card className="border-neutral-800 bg-neutral-900">
            <CardContent className="p-8 prose prose-invert max-w-none">
              <h2 className="text-xl font-semibold text-white mb-4">1. Принятие условий</h2>
              <p className="text-neutral-400 mb-6">
                Используя сайт BroCar, вы соглашаетесь с настоящими условиями использования. 
                Если вы не согласны с условиями, пожалуйста, не используйте наш сайт.
              </p>

              <h2 className="text-xl font-semibold text-white mb-4">2. Описание услуг</h2>
              <p className="text-neutral-400 mb-6">
                BroCar предоставляет платформу для поиска и заказа автозапчастей. 
                Мы работаем с проверенными поставщиками для обеспечения качества товаров.
              </p>

              <h2 className="text-xl font-semibold text-white mb-4">3. Регистрация</h2>
              <p className="text-neutral-400 mb-6">
                Для оформления заказов необходима регистрация. Вы обязуетесь предоставлять 
                достоверную информацию и поддерживать её актуальность.
              </p>

              <h2 className="text-xl font-semibold text-white mb-4">4. Заказы и оплата</h2>
              <ul className="list-disc list-inside text-neutral-400 mb-6 space-y-2">
                <li>Все цены указаны в рублях и включают НДС</li>
                <li>Заказ считается принятым после подтверждения</li>
                <li>Мы оставляем за собой право отменить заказ при отсутствии товара</li>
              </ul>

              <h2 className="text-xl font-semibold text-white mb-4">5. Доставка</h2>
              <p className="text-neutral-400 mb-6">
                Сроки и стоимость доставки зависят от региона и выбранного способа. 
                Подробная информация предоставляется при оформлении заказа.
              </p>

              <h2 className="text-xl font-semibold text-white mb-4">6. Возврат товара</h2>
              <p className="text-neutral-400 mb-6">
                Возврат товара надлежащего качества возможен в течение 14 дней 
                при сохранении товарного вида и упаковки.
              </p>

              <h2 className="text-xl font-semibold text-white mb-4">7. Контакты</h2>
              <p className="text-neutral-400">
                По всем вопросам обращайтесь: <a href="mailto:info@brocar.ru" className="text-orange-500 hover:text-orange-400">info@brocar.ru</a>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
