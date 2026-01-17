import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Metadata } from "next";
import { Mail, Phone, MapPin, Clock, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

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
                <a href="tel:+74012758888" className="text-2xl font-bold text-white hover:text-orange-500 transition-colors block mb-4">
                  +7 (401) 275-88-88
                </a>
                <div className="space-y-2 text-neutral-400">
                  <p className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-500" />
                    Пн-Пт: 9:00 - 18:00
                  </p>
                  <p className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-500" />
                    Сб-Вс: 10:00 - 16:00
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
              <p className="text-xl text-white mb-2">
                Калининград, Советский проспект, д. 182
              </p>
              <p className="text-neutral-400 mb-6">
                5 минут от центра города
              </p>
              
              {/* Map Placeholder */}
              <div className="bg-neutral-800 rounded-xl h-64 flex items-center justify-center">
                <p className="text-neutral-500">Карта загружается...</p>
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
                  <h3 className="font-semibold text-white text-lg mb-3">Режим работы склада</h3>
                  <div className="grid grid-cols-2 gap-4 text-neutral-300">
                    <div>
                      <p className="text-neutral-500 text-sm">Будние дни</p>
                      <p className="font-medium">8:00 - 20:00</p>
                    </div>
                    <div>
                      <p className="text-neutral-500 text-sm">Суббота</p>
                      <p className="font-medium">9:00 - 18:00</p>
                    </div>
                    <div>
                      <p className="text-neutral-500 text-sm">Воскресенье</p>
                      <p className="font-medium">Выходной</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Form Placeholder */}
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
                Если у вас есть вопросы или предложения, напишите нам. 
                Мы ответим в ближайшее время.
              </p>
              
              <div className="flex flex-wrap gap-4">
                <a href="mailto:info@brocar.ru">
                  <Button className="gap-2">
                    <Send className="h-4 w-4" />
                    Написать на email
                  </Button>
                </a>
                <a href="tel:+74012758888">
                  <Button variant="outline" className="gap-2">
                    <Phone className="h-4 w-4" />
                    Позвонить
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
