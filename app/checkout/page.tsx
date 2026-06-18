"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import { ArrowLeft, Loader2, ShoppingBag } from "lucide-react";

interface CartItem {
  id: number;
  qty: number;
  deliveryDays?: number | null;
  product: { name: string; article: string; price: number };
}
interface CartData {
  items: CartItem[];
  total: number;
}

/**
 * Маска российского номера → «+7 (XXX) XXX-XX-XX».
 * Нормализует ведущую 8/7, режет до 11 цифр, форматирует по мере ввода.
 * Если человек опечатался (не 11 цифр) — на сабмите подскажем поправить.
 */
function formatRuPhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (!d) return "";
  if (d[0] === "8") d = "7" + d.slice(1);
  if (d[0] !== "7") d = "7" + d;
  d = d.slice(0, 11);
  const p = d.slice(1);
  let out = "+7";
  if (p.length) out += " (" + p.slice(0, 3);
  if (p.length >= 3) out += ")";
  if (p.length > 3) out += " " + p.slice(3, 6);
  if (p.length > 6) out += "-" + p.slice(6, 8);
  if (p.length > 8) out += "-" + p.slice(8, 10);
  return out;
}

export default function CheckoutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartData | null>(null);

  // поля формы
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [telegram, setTelegram] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [vk, setVk] = useState("");
  const [maxMsg, setMaxMsg] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // профиль (требует входа) — заодно проверяем авторизацию
        const profRes = await fetch("/api/profile");
        if (profRes.status === 401) {
          router.push("/auth/login");
          return;
        }
        const profData = await profRes.json();
        const p = profData.profile || {};
        setFullName(p.full_name || "");
        setPhone(formatRuPhone(p.phone || ""));
        setContactEmail(p.contact_email || p.email || "");
        setTelegram(p.telegram || "");
        setWhatsapp(p.whatsapp || "");
        setVk(p.vk || "");
        setMaxMsg(p.max_messenger || "");

        // корзина
        const cartRes = await fetch("/api/cart");
        const cartData = await cartRes.json();
        setCart(cartData);
      } catch {
        setError("Не удалось загрузить данные");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!fullName.trim()) return setError("Укажите имя и фамилию");
    if (!phone.trim()) return setError("Укажите телефон для связи");
    if (phone.replace(/\D/g, "").length !== 11)
      return setError("Проверьте номер телефона: нужно +7 и 10 цифр");
    const hasNonStockNow = (cart?.items ?? []).some(
      (it) => (it.deliveryDays ?? 0) >= 2
    );
    if (hasNonStockNow && !agreed)
      return setError("Подтвердите согласие с условиями заказа товара под заказ");

    setSubmitting(true);
    try {
      // 1. Сохраняем контактные данные в профиль (чтобы не вводить снова)
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim(),
          contact_email: contactEmail.trim() || null,
          telegram: telegram.trim() || null,
          whatsapp: whatsapp.trim() || null,
          vk: vk.trim() || null,
          max_messenger: maxMsg.trim() || null,
        }),
      });

      // 2. Создаём заказ
      const orderRes = await fetch("/api/orders", { method: "POST" });
      if (orderRes.status === 401) {
        router.push("/auth/login");
        return;
      }
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData?.error || "Не удалось создать заказ");

      // 3. Создаём платёж
      const payRes = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderData.orderId }),
      });
      const payData = await payRes.json();
      if (!payRes.ok || !payData?.confirmationUrl) {
        throw new Error(payData?.error || "Не удалось создать платёж");
      }

      // 4. Редирект на форму оплаты ЮKassa
      window.location.href = payData.confirmationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка оформления");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const items = cart?.items ?? [];
  // Есть ли в заказе товар «под заказ» (срок ≥ 2 дней) — тогда перед оплатой
  // показываем согласие с условиями и блокируем кнопку до отметки.
  const hasNonStock = items.some((it) => (it.deliveryDays ?? 0) >= 2);

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-center px-4">
        <ShoppingBag className="h-12 w-12 text-neutral-700 mb-4" />
        <p className="text-white text-lg mb-4">Корзина пуста</p>
        <Link href="/catalog">
          <Button>В каталог</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Link href="/cart">
            <Button variant="ghost" size="sm" className="gap-2 text-neutral-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Назад в корзину
            </Button>
          </Link>

          <h1 className="text-2xl md:text-3xl font-bold text-white">Оформление заказа</h1>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Форма контактов */}
            <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
              <Card className="border-neutral-800 bg-neutral-900">
                <CardHeader className="border-b border-neutral-800">
                  <CardTitle className="text-lg">Контактные данные</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-sm">
                      {error}
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Имя и фамилия *</Label>
                      <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Иван Иванов" disabled={submitting} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Телефон *</Label>
                      <Input id="phone" type="tel" inputMode="tel" maxLength={18} value={phone} onChange={(e) => setPhone(formatRuPhone(e.target.value))} placeholder="+7 (900) 123-45-67" disabled={submitting} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">Почта для связи</Label>
                    <Input id="contactEmail" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="you@example.com" disabled={submitting} />
                  </div>

                  <div className="pt-2">
                    <p className="text-sm text-neutral-400 mb-3">
                      Мессенджеры для связи <span className="text-neutral-600">(по желанию)</span>
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="telegram">Telegram</Label>
                        <Input id="telegram" value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@username" disabled={submitting} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="whatsapp">WhatsApp</Label>
                        <Input id="whatsapp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+7 (900) 123-45-67" disabled={submitting} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="max">MAX</Label>
                        <Input id="max" value={maxMsg} onChange={(e) => setMaxMsg(e.target.value)} placeholder="ник или телефон" disabled={submitting} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vk">ВКонтакте</Label>
                        <Input id="vk" value={vk} onChange={(e) => setVk(e.target.value)} placeholder="vk.com/id или ник" disabled={submitting} />
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-neutral-500">
                    Эти данные сохранятся в вашем профиле — при следующих заказах вводить заново не нужно.
                  </p>
                </CardContent>
              </Card>
            </form>

            {/* Итог */}
            <div>
              <Card className="border-neutral-800 bg-neutral-900 sticky top-4">
                <CardHeader className="border-b border-neutral-800">
                  <CardTitle className="text-lg">Ваш заказ</CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-3">
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {items.map((it) => (
                      <div key={it.id} className="flex justify-between gap-2 text-sm">
                        <span className="text-neutral-300 truncate">
                          {it.product.name}{" "}
                          <span className="text-neutral-500">× {it.qty}</span>
                        </span>
                        <span className="text-white whitespace-nowrap">
                          {formatPrice(it.product.price * it.qty)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-neutral-800 pt-3 flex justify-between">
                    <span className="text-white font-semibold">Итого</span>
                    <span className="text-orange-500 font-bold text-xl">
                      {formatPrice(cart?.total ?? 0)}
                    </span>
                  </div>
                  {hasNonStock && (
                    <div className="mb-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
                      <p className="text-sm font-semibold text-yellow-400 mb-2">
                        В заказе есть товар под заказ (срок от 2 дней)
                      </p>
                      <p className="text-xs text-neutral-300 mb-2">
                        Оформляя заказ, вы соглашаетесь со следующим:
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-xs text-neutral-400 mb-3">
                        <li>от этого товара нельзя отказаться;</li>
                        <li>качественный товар возврату не подлежит;</li>
                        <li>вы обязуетесь принять и оплатить товар;</li>
                        <li>вы согласны со сроками доставки (срок указан в рабочих днях);</li>
                        <li>
                          описание товара и информация об аналогах носит
                          справочный характер и не является причиной для отказа
                          или возврата;
                        </li>
                        <li>
                          товар, ввезённый по параллельному импорту, может
                          отличаться упаковкой и надписями на ней.
                        </li>
                      </ul>
                      <label className="flex items-start gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={agreed}
                          onChange={(e) => setAgreed(e.target.checked)}
                          disabled={submitting}
                          className="mt-0.5 h-4 w-4 accent-orange-500 shrink-0"
                        />
                        <span className="text-sm text-white font-medium">
                          Я согласен с условиями заказа товара под заказ
                        </span>
                      </label>
                    </div>
                  )}

                  <Button
                    onClick={handleSubmit}
                    className="w-full gap-2"
                    size="lg"
                    disabled={submitting || (hasNonStock && !agreed)}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Переходим к оплате…
                      </>
                    ) : (
                      "Перейти к оплате"
                    )}
                  </Button>
                  <p className="text-xs text-neutral-500 text-center">
                    Оплата онлайн картой или через СБП
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
