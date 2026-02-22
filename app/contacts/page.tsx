import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Metadata } from "next";
import { Mail, Phone, MapPin, Clock, MessageCircle, Send, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import NextImage from "next/image";
import Link from "next/link";
import { ContactsShopImage } from "@/components/contacts-shop-image";

function VkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12.785 16.241s.288-.032.436-.194c.136-.148.132-.427.132-.427s-.02-1.304.587-1.496c.598-.189 1.367 1.259 2.182 1.815.616.42 1.084.328 1.084.328l2.175-.03s1.14-.07.599-.964c-.044-.073-.314-.661-1.618-1.869-1.366-1.265-1.183-1.06.462-3.248.999-1.33 1.398-2.142 1.273-2.49-.12-.331-.854-.244-.854-.244l-2.45.015s-.182-.025-.317.056c-.131.079-.216.263-.216.263s-.387 1.028-.903 1.903c-1.089 1.85-1.524 1.948-1.702 1.833-.414-.267-.31-1.075-.31-1.649 0-1.793.272-2.54-.53-2.733-.266-.064-.462-.106-1.143-.113-.874-.009-1.614.003-2.033.208-.279.136-.494.44-.363.457.162.022.528.099.723.363.25.341.242 1.11.242 1.11s.144 2.11-.336 2.372c-.33.18-.781-.187-1.75-1.866-.496-.86-.871-1.81-.871-1.81s-.072-.177-.201-.272c-.156-.115-.374-.151-.374-.151l-2.328.015s-.35.01-.478.161c-.114.135-.009.414-.009.414s1.816 4.244 3.871 6.381c1.884 1.96 4.025 1.832 4.025 1.832h.97z" />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function TwoGisIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-.5 5.5h2.8c1.3 0 2.2.9 2.2 2.2 0 .9-.5 1.6-1.2 1.9.9.2 1.5 1.1 1.5 2.1 0 1.4-1 2.4-2.4 2.4H11.5V5.5zm1.5 3.5h1.2c.5 0 .8-.3.8-.8s-.3-.8-.8-.8H13V9zm0 3.6h1.3c.6 0 .9-.4.9-.9s-.3-.9-.9-.9H13v1.8zM7 17.5v-1.3l2.5-2.7c.6-.7.8-1 .8-1.5 0-.6-.4-.9-.9-.9-.5 0-.9.3-1.1.8L7 11.3c.3-1 1.2-1.8 2.5-1.8 1.4 0 2.4.9 2.4 2.2 0 .8-.3 1.4-1.2 2.4l-1.3 1.4h2.6v1.5H7z" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export const metadata: Metadata = {
  title: "Контакты",
  description: "Свяжитесь с нами - BroCar",
};

export default function ContactsPage() {
  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-16">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-600/10 via-neutral-950 to-neutral-950" />
        <div className="absolute top-10 right-20 w-72 h-72 bg-orange-500/10 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Контакты</h1>
            <p className="text-xl text-neutral-400">
              Мы всегда на связи и готовы помочь с подбором запчастей
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto">
          {/* Contact Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {/* Phone Card */}
            <Card className="border-neutral-800 bg-neutral-900 hover:border-orange-500/50 transition-colors">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                    <Phone className="h-6 w-6 text-orange-500" />
                  </div>
                  <span>Телефон</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <a href="tel:+79326006052" className="text-2xl font-bold text-white hover:text-orange-500 transition-colors block mb-2">
                  +7 (932) 600-60-52
                </a>
                <a href="tel:+79326006015" className="text-lg text-neutral-300 hover:text-orange-500 transition-colors block mb-4">
                  +7 (932) 600-60-15
                </a>
                <div className="space-y-2 text-neutral-400">
                  <p className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-500" />
                    Пн — Пт: 10:00 — 18:00
                  </p>
                  <p className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-neutral-600" />
                    <span className="text-neutral-500">Сб — Вс: выходной</span>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Email Card */}
            <Card className="border-neutral-800 bg-neutral-900 hover:border-orange-500/50 transition-colors">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                    <Mail className="h-6 w-6 text-orange-500" />
                  </div>
                  <span>Email</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <a href="mailto:info@brocar.ru" className="text-2xl font-bold text-white hover:text-orange-500 transition-colors block mb-4">
                  info@brocar.ru
                </a>
                <p className="text-neutral-400">
                  Ответим в течение 24 часов в рабочие дни
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Address Card */}
          <Card className="border-neutral-800 bg-neutral-900 mb-12">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                  <MapPin className="h-6 w-6 text-orange-500" />
                </div>
                <span>Адрес</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-6 mb-6">
                <div className="flex-1">
                  <p className="text-xl text-white mb-2">
                    г. Екатеринбург, ул. Заводская, 16
                  </p>
                  <p className="text-neutral-400">
                    1 этаж, район ВИЗ
                  </p>
                </div>
                <ContactsShopImage />
              </div>
              
              {/* Yandex Map */}
              <div className="rounded-xl overflow-hidden h-80 border border-neutral-700">
                <iframe
                  src="https://yandex.ru/map-widget/v1/?ll=60.579500%2C56.838500&z=16&pt=60.579500%2C56.838500%2Cpm2rdm&lang=ru_RU"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  title="BroCar — Екатеринбург, ул. Заводская, 16"
                />
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-4">
                <a 
                  href="https://2gis.ru/ekaterinburg/firm/70000001098987045" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[#1DAD50] hover:text-[#15983F] transition-colors text-sm font-medium"
                >
                  <NextImage src="/2gis-footer-logo.png" alt="2ГИС" width={20} height={20} className="w-5 h-5 object-contain" />
                  Открыть в 2ГИС <ExternalLink className="h-3 w-3" />
                </a>
                <a 
                  href="https://yandex.ru/maps/?pt=60.579500,56.838500&z=16&l=map" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-orange-500 hover:text-orange-400 transition-colors text-sm font-medium"
                >
                  <MapPin className="h-4 w-4" />
                  Яндекс Карты <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Working Hours */}
          <Card className="border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-orange-600/5 mb-12">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center shrink-0">
                  <Clock className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-lg mb-4">Режим работы магазина</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-neutral-300">
                    {[
                      { day: "Пн", time: "10:00 — 18:00" },
                      { day: "Вт", time: "10:00 — 18:00" },
                      { day: "Ср", time: "10:00 — 18:00" },
                      { day: "Чт", time: "10:00 — 18:00" },
                      { day: "Пт", time: "10:00 — 18:00" },
                      { day: "Сб", time: "Выходной", off: true },
                      { day: "Вс", time: "Выходной", off: true },
                    ].map((item) => (
                      <div 
                        key={item.day} 
                        className={`text-center p-3 rounded-lg ${
                          item.off 
                            ? "bg-red-500/10 border border-red-500/20" 
                            : "bg-neutral-800/50 border border-neutral-700/50"
                        }`}
                      >
                        <p className={`text-sm font-medium mb-1 ${item.off ? "text-red-400" : "text-orange-500"}`}>
                          {item.day}
                        </p>
                        <p className={`text-xs font-medium ${item.off ? "text-red-400/70" : "text-neutral-300"}`}>
                          {item.time}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Social Media */}
          <Card className="border-neutral-800 bg-neutral-900 mb-12">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                  <ExternalLink className="h-6 w-6 text-orange-500" />
                </div>
                <span>Мы в соцсетях</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-neutral-400 mb-6">
                Подписывайтесь, чтобы быть в курсе акций и новинок
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <a
                  href="https://vk.com/brocarparts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 bg-neutral-800 hover:bg-[#0077FF]/20 border border-neutral-700 hover:border-[#0077FF]/50 rounded-xl transition-all group"
                >
                  <div className="w-12 h-12 bg-[#0077FF]/20 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-[#0077FF]/30">
                    <VkIcon className="h-6 w-6 text-[#0077FF]" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">ВКонтакте</p>
                    <p className="text-sm text-neutral-400">@brocarparts</p>
                  </div>
                </a>

                <a
                  href="https://t.me/+79326006052"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 bg-neutral-800 hover:bg-[#26A5E4]/20 border border-neutral-700 hover:border-[#26A5E4]/50 rounded-xl transition-all group"
                >
                  <div className="w-12 h-12 bg-[#26A5E4]/20 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-[#26A5E4]/30">
                    <TelegramIcon className="h-6 w-6 text-[#26A5E4]" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Telegram</p>
                    <p className="text-sm text-neutral-400">Написать нам</p>
                  </div>
                </a>

                <a
                  href="https://2gis.ru/ekaterinburg/firm/70000001098987045"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 bg-neutral-800 hover:bg-[#1DAD50]/20 border border-neutral-700 hover:border-[#1DAD50]/50 rounded-xl transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                    <NextImage
                      src="/2gis-footer-logo.png"
                      alt="2ГИС"
                      width={48}
                      height={48}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-white">2ГИС</p>
                    <p className="text-sm text-neutral-400">Отзывы и маршрут</p>
                  </div>
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Contact Actions */}
          <Card className="border-neutral-800 bg-neutral-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                  <MessageCircle className="h-6 w-6 text-orange-500" />
                </div>
                <span>Обратная связь</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-neutral-400 mb-6">
                Если у вас есть вопросы или предложения — напишите нам удобным способом. 
                Ответим в ближайшее время.
              </p>
              
              <div className="flex flex-wrap gap-3">
                <a href="https://wa.me/79326006052" target="_blank" rel="noopener noreferrer">
                  <Button className="gap-2 bg-[#25D366] hover:bg-[#1EBE57] text-white">
                    <WhatsAppIcon className="h-4 w-4" />
                    WhatsApp
                  </Button>
                </a>
                <a href="https://t.me/+79326006052" target="_blank" rel="noopener noreferrer">
                  <Button className="gap-2 bg-[#26A5E4] hover:bg-[#1E96D1] text-white">
                    <TelegramIcon className="h-4 w-4" />
                    Telegram
                  </Button>
                </a>
                <a href="tel:+79326006052">
                  <Button variant="outline" className="gap-2">
                    <Phone className="h-4 w-4" />
                    Позвонить
                  </Button>
                </a>
                <a href="mailto:info@brocar.ru">
                  <Button variant="outline" className="gap-2">
                    <Send className="h-4 w-4" />
                    Email
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
