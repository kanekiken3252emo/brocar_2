"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Phone,
  User,
  MessageSquare,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Форма «Не нашли запчасть?» в конце главной. Поля: имя, телефон (оба
 * обязательны) и запрос (по желанию). Заявка уходит на info@brocarparts.ru
 * через /api/part-request.
 */
export default function ContactRequestForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  function validate() {
    let ok = true;
    if (!name.trim()) {
      setNameError("Укажите имя");
      ok = false;
    } else {
      setNameError("");
    }
    // Хотя бы 6 цифр в номере — без привязки к формату.
    if ((phone.match(/\d/g) ?? []).length < 6) {
      setPhoneError("Укажите корректный номер телефона");
      ok = false;
    } else {
      setPhoneError("");
    }
    return ok;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setStatus("loading");
    try {
      const res = await fetch("/api/part-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          query: query.trim(),
        }),
      });
      if (!res.ok) throw new Error("request failed");
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  function handleReset() {
    setName("");
    setPhone("");
    setQuery("");
    setNameError("");
    setPhoneError("");
    setStatus("idle");
  }

  return (
    <section className="py-10 md:py-20">
      <div className="container mx-auto px-4">
        <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-neutral-900 border border-neutral-800">
          {/* Декоративное оранжевое свечение */}
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-orange-500/10 to-transparent pointer-events-none" />
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-orange-500/10 rounded-full blur-3xl pointer-events-none hidden md:block" />

          <div className="relative z-10 grid lg:grid-cols-2 gap-8 lg:gap-12 p-6 md:p-10 lg:p-12">
            {/* Левая часть — текст */}
            <div className="flex flex-col justify-center">
              <h2 className="text-2xl md:text-4xl font-bold text-white mb-3 md:mb-4">
                Не нашли нужную запчасть?
              </h2>
              <p className="text-neutral-400 text-sm md:text-lg leading-relaxed mb-5">
                Оставьте заявку — подберём деталь под ваш автомобиль, проверим
                наличие у поставщиков и сообщим цену и сроки.
              </p>
              <div className="hidden lg:flex flex-col gap-2.5 text-sm text-neutral-400">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-orange-500 shrink-0" />
                  Ответим в рабочее время: Пн–Пт 10:00–19:00, Сб 10:00–15:00
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-orange-500 shrink-0" />
                  Подбор по оригинальным и аналоговым номерам
                </span>
              </div>
            </div>

            {/* Правая часть — форма / успех */}
            <div>
              {status === "success" ? (
                <div className="h-full flex flex-col items-center justify-center text-center bg-green-500/10 border border-green-500/30 rounded-2xl p-8">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-5">
                    <CheckCircle2 className="h-8 w-8 text-green-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Заявка отправлена!
                  </h3>
                  <p className="text-neutral-400 mb-6">
                    Свяжемся с вами по номеру{" "}
                    <span className="text-white font-medium">{phone}</span> в
                    ближайшее рабочее время.
                  </p>
                  <Button onClick={handleReset} variant="outline" className="gap-2">
                    <Send className="h-4 w-4" />
                    Отправить ещё одну
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate className="space-y-4">
                  {/* Имя */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="cr-name"
                      className="text-neutral-300 text-sm font-medium"
                    >
                      Имя <span className="text-orange-500">*</span>
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 pointer-events-none" />
                      <Input
                        id="cr-name"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          if (nameError) setNameError("");
                        }}
                        placeholder="Как к вам обращаться"
                        className={`pl-10 ${
                          nameError
                            ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                            : ""
                        }`}
                        autoComplete="name"
                      />
                    </div>
                    {nameError && (
                      <p className="flex items-start gap-1.5 text-red-400 text-sm">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        {nameError}
                      </p>
                    )}
                  </div>

                  {/* Телефон */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="cr-phone"
                      className="text-neutral-300 text-sm font-medium"
                    >
                      Номер телефона <span className="text-orange-500">*</span>
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 pointer-events-none" />
                      <Input
                        id="cr-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          if (phoneError) setPhoneError("");
                        }}
                        placeholder="+7 (___) ___-__-__"
                        className={`pl-10 ${
                          phoneError
                            ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                            : ""
                        }`}
                        autoComplete="tel"
                      />
                    </div>
                    {phoneError && (
                      <p className="flex items-start gap-1.5 text-red-400 text-sm">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        {phoneError}
                      </p>
                    )}
                  </div>

                  {/* Запрос */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="cr-query"
                      className="text-neutral-300 text-sm font-medium"
                    >
                      Ваш запрос{" "}
                      <span className="text-neutral-500 font-normal">
                        (по желанию)
                      </span>
                    </Label>
                    <div className="relative">
                      <MessageSquare className="absolute left-3.5 top-3.5 h-4 w-4 text-neutral-500 pointer-events-none" />
                      <textarea
                        id="cr-query"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Что ищете: марка/модель авто, VIN, артикул или название детали"
                        rows={3}
                        className="w-full rounded-xl border border-neutral-700 bg-neutral-800/50 pl-10 pr-4 py-3 text-sm text-white placeholder-neutral-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none transition-colors"
                      />
                    </div>
                  </div>

                  {status === "error" && (
                    <p className="flex items-start gap-1.5 text-red-400 text-sm">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      Не удалось отправить заявку. Попробуйте ещё раз или
                      позвоните нам.
                    </p>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full gap-2"
                    disabled={status === "loading"}
                  >
                    {status === "loading" ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Отправляем...
                      </>
                    ) : (
                      <>
                        <Send className="h-5 w-5" />
                        Отправить заявку
                      </>
                    )}
                  </Button>

                  {/* Пассивное согласие */}
                  <p className="text-xs text-neutral-500 flex items-start gap-1.5">
                    <Shield className="h-3.5 w-3.5 mt-0.5 shrink-0 text-neutral-600" />
                    <span>
                      Нажимая кнопку, вы соглашаетесь с{" "}
                      <Link
                        href="/legal/privacy"
                        className="text-orange-500/80 hover:text-orange-500 underline underline-offset-2"
                      >
                        политикой конфиденциальности
                      </Link>{" "}
                      и обработкой персональных данных.
                    </span>
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
