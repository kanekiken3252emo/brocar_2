"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Search,
  CheckCircle2,
  AlertCircle,
  Car,
  FileText,
  Phone,
  MessageSquare,
  Info,
  ChevronRight,
  Loader2,
  Shield,
  Zap,
  Clock,
} from "lucide-react";
import Link from "next/link";

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i;

const VIN_LOCATIONS = [
  {
    title: "Передняя стойка двери",
    description: "Наклейка на стойке водительской двери (при открытой двери)",
  },
  {
    title: "Лобовое стекло",
    description: "Нижний левый угол лобового стекла, виден снаружи",
  },
  {
    title: "Моторный отсек",
    description: "Табличка на щите передка или на верхней балке",
  },
  {
    title: "Документы",
    description: "ПТС, СТС или страховой полис",
  },
];

const HOW_IT_WORKS = [
  {
    number: "01",
    icon: <FileText className="h-5 w-5" />,
    title: "Введите VIN",
    description: "Укажите 17-значный VIN-код вашего автомобиля и контактный номер телефона",
  },
  {
    number: "02",
    icon: <Search className="h-5 w-5" />,
    title: "Мы подбираем",
    description: "Наши специалисты проверяют наличие запчастей у всех поставщиков по вашему VIN",
  },
  {
    number: "03",
    icon: <Phone className="h-5 w-5" />,
    title: "Получите ответ",
    description: "Свяжемся с вами и озвучим наличие, цены и сроки доставки",
  },
];

export default function VinSearchPage() {
  const [vin, setVin] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [vinError, setVinError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const normalizedVin = vin.trim().toUpperCase();
  const vinValid = VIN_REGEX.test(normalizedVin);
  const vinLength = normalizedVin.length;

  function validateForm() {
    let valid = true;

    if (!normalizedVin) {
      setVinError("Введите VIN-код");
      valid = false;
    } else if (!vinValid) {
      setVinError("VIN должен содержать ровно 17 символов (буквы A–Z кроме I, O, Q и цифры 0–9)");
      valid = false;
    } else {
      setVinError("");
    }

    if (!phone.trim()) {
      setPhoneError("Введите номер телефона для обратной связи");
      valid = false;
    } else {
      setPhoneError("");
    }

    return valid;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm()) return;

    setStatus("loading");

    // TODO: подключить реальный API когда будет готова база данных
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setStatus("success");
  }

  function handleReset() {
    setVin("");
    setPhone("");
    setComment("");
    setVinError("");
    setPhoneError("");
    setStatus("idle");
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Hero */}
      <section className="relative overflow-hidden py-16 md:py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-600/15 via-neutral-950 to-neutral-950" />
        <div className="absolute top-10 right-20 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-48 h-48 bg-orange-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="flex items-center gap-2 text-neutral-500 text-sm mb-6">
            <Link href="/" className="hover:text-orange-500 transition-colors">
              Главная
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-neutral-300">Запрос по VIN</span>
          </div>

          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-1.5 mb-5">
              <Car className="h-4 w-4 text-orange-500" />
              <span className="text-orange-400 text-sm font-medium">Точный подбор запчастей</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
              Запрос по{" "}
              <span className="text-orange-500">VIN-коду</span>
            </h1>
            <p className="text-lg text-neutral-400 max-w-xl">
              Укажите VIN вашего автомобиля — мы подберём оригинальные и аналоговые запчасти
              по наличию и ценам у всех наших поставщиков.
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 pb-20">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-5 gap-8">

            {/* Form */}
            <div className="lg:col-span-3">
              {status === "success" ? (
                <Card className="border-green-500/30 bg-gradient-to-br from-green-500/10 to-neutral-900">
                  <CardContent className="p-8 text-center">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
                      <CheckCircle2 className="h-8 w-8 text-green-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-3">Запрос отправлен!</h2>
                    <p className="text-neutral-400 mb-2">
                      Мы получили ваш запрос по VIN:
                    </p>
                    <div className="inline-block bg-neutral-800 border border-neutral-700 rounded-xl px-5 py-2.5 mb-6">
                      <span className="font-mono text-lg font-bold text-orange-400 tracking-widest">
                        {normalizedVin}
                      </span>
                    </div>
                    <p className="text-neutral-400 mb-8">
                      Свяжемся с вами по номеру{" "}
                      <span className="text-white font-medium">{phone}</span>{" "}
                      в ближайшее рабочее время.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Button onClick={handleReset} variant="outline" className="gap-2">
                        <Search className="h-4 w-4" />
                        Новый запрос
                      </Button>
                      <Link href="/catalog">
                        <Button className="gap-2 w-full sm:w-auto">
                          Перейти в каталог
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-neutral-800 bg-neutral-900">
                  <CardContent className="p-6 md:p-8">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                      <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                        <Car className="h-4 w-4 text-orange-500" />
                      </div>
                      Данные запроса
                    </h2>

                    <form onSubmit={handleSubmit} noValidate className="space-y-5">
                      {/* VIN field */}
                      <div className="space-y-2">
                        <Label htmlFor="vin" className="text-neutral-300 text-sm font-medium">
                          VIN-код автомобиля <span className="text-orange-500">*</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id="vin"
                            value={vin}
                            onChange={(e) => {
                              setVin(e.target.value.toUpperCase());
                              if (vinError) setVinError("");
                            }}
                            placeholder="Например: XTA21099051234567"
                            maxLength={17}
                            className={`font-mono tracking-widest pr-16 uppercase ${
                              vinError
                                ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                                : vinValid
                                ? "border-green-500/50 focus:border-green-500 focus:ring-green-500/20"
                                : ""
                            }`}
                            autoComplete="off"
                            spellCheck={false}
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            <span
                              className={`text-xs font-mono tabular-nums ${
                                vinLength === 17
                                  ? "text-green-400"
                                  : vinLength > 0
                                  ? "text-orange-400"
                                  : "text-neutral-600"
                              }`}
                            >
                              {vinLength}/17
                            </span>
                            {vinValid && (
                              <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                            )}
                          </div>
                        </div>
                        {vinError && (
                          <p className="flex items-start gap-1.5 text-red-400 text-sm">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            {vinError}
                          </p>
                        )}
                        {!vinError && normalizedVin && !vinValid && (
                          <p className="text-neutral-500 text-xs">
                            VIN должен содержать 17 символов. Сейчас:{" "}
                            <span className="text-orange-400">{vinLength}</span>
                          </p>
                        )}
                      </div>

                      {/* Phone field */}
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-neutral-300 text-sm font-medium">
                          Номер телефона <span className="text-orange-500">*</span>
                        </Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => {
                            setPhone(e.target.value);
                            if (phoneError) setPhoneError("");
                          }}
                          placeholder="+7 (___) ___-__-__"
                          className={
                            phoneError
                              ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                              : ""
                          }
                        />
                        {phoneError && (
                          <p className="flex items-start gap-1.5 text-red-400 text-sm">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            {phoneError}
                          </p>
                        )}
                      </div>

                      {/* Comment field */}
                      <div className="space-y-2">
                        <Label htmlFor="comment" className="text-neutral-300 text-sm font-medium">
                          Комментарий{" "}
                          <span className="text-neutral-500 font-normal">(необязательно)</span>
                        </Label>
                        <textarea
                          id="comment"
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="Укажите, какие именно запчасти вас интересуют, симптомы неисправности или другие детали..."
                          rows={3}
                          className="w-full rounded-xl border border-neutral-700 bg-neutral-800/50 px-4 py-3 text-sm text-white placeholder-neutral-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none transition-colors"
                        />
                      </div>

                      {/* Privacy note */}
                      <p className="text-xs text-neutral-500 flex items-start gap-1.5">
                        <Shield className="h-3.5 w-3.5 mt-0.5 shrink-0 text-neutral-600" />
                        Нажимая кнопку, вы соглашаетесь с{" "}
                        <Link href="/legal/privacy" className="text-orange-500/80 hover:text-orange-500 underline underline-offset-2">
                          политикой конфиденциальности
                        </Link>
                      </p>

                      <Button
                        type="submit"
                        size="lg"
                        className="w-full gap-2"
                        disabled={status === "loading"}
                      >
                        {status === "loading" ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Отправляем запрос...
                          </>
                        ) : (
                          <>
                            <Search className="h-5 w-5" />
                            Отправить запрос
                          </>
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* Contacts hint */}
              <Card className="border-neutral-800 bg-neutral-900 mt-4">
                <CardContent className="p-5">
                  <p className="text-neutral-400 text-sm mb-3 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-orange-500 shrink-0" />
                    Предпочитаете написать напрямую?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <a href="https://t.me/+79326006052" target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                        Telegram
                      </Button>
                    </a>
                    <a href="https://wa.me/79326006052" target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                        WhatsApp
                      </Button>
                    </a>
                    <a href="tel:+79326006052">
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                        <Phone className="h-3.5 w-3.5" />
                        Позвонить
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-2 space-y-5">
              {/* How it works */}
              <Card className="border-neutral-800 bg-neutral-900">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-white mb-5 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-orange-500" />
                    Как это работает
                  </h3>
                  <div className="space-y-5">
                    {HOW_IT_WORKS.map((step, i) => (
                      <div key={step.number} className="flex gap-4">
                        <div className="shrink-0 flex flex-col items-center">
                          <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/20 flex items-center justify-center text-orange-500">
                            {step.icon}
                          </div>
                          {i < HOW_IT_WORKS.length - 1 && (
                            <div className="w-px flex-1 bg-neutral-800 mt-2" />
                          )}
                        </div>
                        <div className="pb-5">
                          <p className="text-xs text-orange-500/70 font-mono mb-0.5">{step.number}</p>
                          <p className="font-medium text-white text-sm mb-1">{step.title}</p>
                          <p className="text-neutral-500 text-xs leading-relaxed">{step.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Working hours */}
              <Card className="border-orange-500/20 bg-orange-500/5">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-white text-sm mb-1">Время ответа</p>
                      <p className="text-neutral-400 text-xs leading-relaxed">
                        Заявки обрабатываются в рабочее время:
                      </p>
                      <p className="text-orange-400 text-xs font-medium mt-1">
                        Пн — Пт: 10:00 — 18:00
                      </p>
                      <p className="text-neutral-500 text-xs">Сб — Вс: выходной</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Where to find VIN */}
              <Card className="border-neutral-800 bg-neutral-900">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <Info className="h-4 w-4 text-orange-500" />
                    Где найти VIN
                  </h3>
                  <ul className="space-y-3">
                    {VIN_LOCATIONS.map((loc) => (
                      <li key={loc.title} className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-2 shrink-0" />
                        <div>
                          <p className="text-white text-sm font-medium">{loc.title}</p>
                          <p className="text-neutral-500 text-xs mt-0.5">{loc.description}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* VIN info */}
              <Card className="border-neutral-800 bg-neutral-900">
                <CardContent className="p-5">
                  <h3 className="font-semibold text-white mb-3 flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4 text-orange-500" />
                    Что такое VIN?
                  </h3>
                  <p className="text-neutral-400 text-xs leading-relaxed">
                    VIN (Vehicle Identification Number) — уникальный 17-значный номер каждого
                    автомобиля. По нему определяются точные характеристики: год выпуска,
                    двигатель, комплектация, страна производства. Это гарантирует точный подбор
                    запчастей без ошибок.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
