"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ProductImage from "@/components/Items/ProductImage";
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  ChevronRight,
  ArrowRight,
  Search,
  Car,
  Loader2,
  PackageOpen,
  Tag,
  Phone,
  Truck,
} from "lucide-react";
import { formatDeliveryDays } from "@/lib/utils";

// ─── types ────────────────────────────────────────────────────────────────────

interface CartProduct {
  id: number;
  article: string;
  brand: string;
  name: string;
  price: number;
  stock: number;
}

interface CartItem {
  id: number;
  productId: number;
  qty: number;
  /** Снимок цены оффера этой строки (та, что в сумме и в заказе). */
  price: number;
  deliveryDays?: number | null;
  product: CartProduct;
}

interface CartPromo {
  code: string;
  discountPct: number;
  discountAmount: number;
}

interface CartData {
  id?: number;
  items: CartItem[];
  subtotal: number;
  total: number;
  promo?: CartPromo | null;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatPrice(n: number) {
  return n.toLocaleString("ru-RU") + " ₽";
}

async function apiCart(body: object) {
  const res = await fetch("/api/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("cart error");
  // Бейдж счётчика в хедере слушает это событие
  window.dispatchEvent(new CustomEvent("cart:updated"));
  return res.json() as Promise<CartData>;
}

// ─── empty state ──────────────────────────────────────────────────────────────

function EmptyCart() {
  return (
    <div className="flex flex-col items-center text-center pt-2 pb-10 sm:pt-6 px-4">
      <div className="w-20 h-20 bg-neutral-900 border border-neutral-800 rounded-3xl flex items-center justify-center mb-5">
        <PackageOpen className="h-9 w-9 text-neutral-600" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Корзина пуста</h2>
      <p className="text-neutral-400 max-w-sm mb-6 leading-relaxed">
        Добавьте запчасти из каталога или оформите запрос по VIN‑коду — мы
        подберём нужные детали.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <Link href="/catalog" className="flex-1">
          <Button className="w-full gap-2">
            <Search className="h-4 w-4" />
            Каталог
          </Button>
        </Link>
        <Link href="/catalog-vin" className="flex-1">
          <Button variant="outline" className="w-full gap-2">
            <Car className="h-4 w-4" />
            Запрос по VIN
          </Button>
        </Link>
      </div>

      {/* Hints */}
      <div className="grid sm:grid-cols-3 gap-4 mt-8 w-full max-w-2xl">
        {[
          {
            icon: <Tag className="h-5 w-5 text-orange-500" />,
            title: "Лучшие цены",
            desc: "Работаем напрямую с поставщиками без посредников",
          },
          {
            icon: <Car className="h-5 w-5 text-orange-500" />,
            title: "Подбор по VIN",
            desc: "Точный подбор запчастей по номеру кузова",
          },
          {
            icon: <Phone className="h-5 w-5 text-orange-500" />,
            title: "Консультация",
            desc: "Специалисты помогут с выбором: +7 (932) 600‑60‑15, 8 (343) 382‑20‑62",
          },
        ].map((h) => (
          <div
            key={h.title}
            className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 text-left hover:border-orange-500/30 transition-colors flex flex-col sm:flex-row sm:items-center gap-3"
          >
            <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center shrink-0">
              {h.icon}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-white text-sm mb-1">{h.title}</p>
              <p className="text-neutral-400 text-xs leading-relaxed">
                {h.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── item row ─────────────────────────────────────────────────────────────────

function CartItemRow({
  item,
  onRemove,
  onUpdateQty,
  loading,
  checked,
  onToggleSelect,
}: {
  item: CartItem;
  onRemove: (id: number) => void;
  onUpdateQty: (id: number, qty: number) => void;
  loading: boolean;
  checked: boolean;
  onToggleSelect: (id: number) => void;
}) {
  return (
    <div
      className={`flex gap-3 sm:gap-4 p-4 sm:p-5 bg-neutral-900 border rounded-2xl transition-colors ${
        checked
          ? "border-neutral-800 hover:border-neutral-700"
          : "border-neutral-800/60"
      }`}
    >
      {/* Чекбокс: отметить позицию для заказа. Снятые не попадают в заказ. */}
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggleSelect(item.id)}
        className="mt-1 h-5 w-5 accent-orange-500 shrink-0 cursor-pointer"
        aria-label={checked ? "Убрать из заказа" : "Добавить в заказ"}
      />
      <div
        className={`flex flex-col sm:flex-row gap-4 flex-1 min-w-0 transition-opacity ${
          checked ? "" : "opacity-50"
        }`}
      >
        {/* Image */}
        <ProductImage
        brand={item.product.brand}
        article={item.product.article}
        alt={item.product.name}
        className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl shrink-0"
        innerPadding="p-2"
        sizes="96px"
      />

      {/* Product info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap gap-2 mb-2">
          <span className="text-xs font-mono bg-neutral-800 text-neutral-300 rounded-md px-2 py-0.5">
            {item.product.article}
          </span>
          <span className="text-xs text-neutral-500 bg-neutral-800 rounded-md px-2 py-0.5">
            {item.product.brand}
          </span>
          {item.product.stock > 0 ? (
            <span className="text-xs text-green-400 bg-green-500/10 rounded-md px-2 py-0.5">
              В наличии
            </span>
          ) : (
            <span className="text-xs text-yellow-400 bg-yellow-500/10 rounded-md px-2 py-0.5">
              Под заказ
            </span>
          )}
          {item.deliveryDays != null && (
            <span className="text-xs text-neutral-300 bg-neutral-800 rounded-md px-2 py-0.5 inline-flex items-center gap-1">
              <Truck className="h-3 w-3 text-orange-500" />
              {formatDeliveryDays(item.deliveryDays)}
            </span>
          )}
        </div>
        <p className="text-white font-medium leading-snug">
          {item.product.name}
        </p>
        <p className="text-orange-500 font-bold text-lg mt-1">
          {formatPrice(item.price)}
        </p>
      </div>

      {/* Qty + remove */}
      <div className="flex items-center gap-3 sm:flex-col sm:items-end justify-between sm:justify-start">
        {/* Quantity */}
        <div className="flex items-center gap-2 bg-neutral-800 border border-neutral-700 rounded-xl p-1">
          <button
            onClick={() => onUpdateQty(item.id, item.qty - 1)}
            disabled={loading || item.qty <= 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Уменьшить"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-8 text-center text-white font-semibold text-sm tabular-nums">
            {item.qty}
          </span>
          <button
            onClick={() => onUpdateQty(item.id, item.qty + 1)}
            disabled={loading}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Увеличить"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Subtotal + remove */}
        <div className="flex items-center gap-3 sm:flex-row-reverse">
          <p className="text-neutral-300 font-semibold tabular-nums">
            {formatPrice(item.price * item.qty)}
          </p>
          <button
            onClick={() => onRemove(item.id)}
            disabled={loading}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-600 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors"
            aria-label="Удалить"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function CartPage() {
  const [cart, setCart] = useState<CartData | null>(null);
  const [fetchStatus, setFetchStatus] = useState<"loading" | "ok" | "error">(
    "loading"
  );
  const [mutating, setMutating] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  // Отмеченные позиции для заказа (id строк). null = ещё не инициализировано.
  const [selected, setSelected] = useState<Set<number> | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  const fetchCart = useCallback(async () => {
    try {
      const res = await fetch("/api/cart");
      if (!res.ok) throw new Error();
      const data: CartData = await res.json();
      setCart(data);
      setFetchStatus("ok");
    } catch {
      setCart({ items: [], subtotal: 0, total: 0 });
      setFetchStatus("ok"); // treat API error as empty cart (DB not connected yet)
    }
  }, []);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // Синхронизируем выбор с содержимым корзины: первая загрузка — все отмечены;
  // далее сохраняем выбор, отбрасывая удалённые позиции.
  useEffect(() => {
    if (!cart) return;
    const ids = cart.items.map((i) => i.id);
    setSelected((prev) => {
      if (prev === null) return new Set(ids);
      const next = new Set<number>();
      for (const id of ids) if (prev.has(id)) next.add(id);
      return next;
    });
  }, [cart]);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const base = prev ?? new Set((cart?.items ?? []).map((i) => i.id));
      const next = new Set(base);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const ids = (cart?.items ?? []).map((i) => i.id);
    setSelected((prev) => {
      const base = prev ?? new Set(ids);
      const isAll = ids.length > 0 && ids.every((id) => base.has(id));
      return isAll ? new Set<number>() : new Set(ids);
    });
  }

  async function handleUpdate(cartItemId: number, qty: number) {
    setMutating(true);
    try {
      const data = await apiCart({ action: "update", cartItemId, qty });
      setCart(data);
    } catch {
      /* ignore */
    } finally {
      setMutating(false);
    }
  }

  async function handleRemove(cartItemId: number) {
    setMutating(true);
    try {
      const data = await apiCart({ action: "remove", cartItemId });
      setCart(data);
    } catch {
      /* ignore */
    } finally {
      setMutating(false);
    }
  }

  async function applyPromo(e: React.FormEvent) {
    e.preventDefault();
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setPromoBusy(true);
    setPromoError(null);
    try {
      const res = await fetch("/api/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) {
        setPromoError(data.error || "Не удалось применить промокод");
        return;
      }
      setPromoInput("");
      await fetchCart(); // перечитываем корзину со скидкой и новым итогом
    } catch {
      setPromoError("Не удалось применить промокод");
    } finally {
      setPromoBusy(false);
    }
  }

  async function removePromo() {
    setPromoBusy(true);
    setPromoError(null);
    try {
      await fetch("/api/promo", { method: "DELETE" });
      await fetchCart();
    } catch {
      /* ignore */
    } finally {
      setPromoBusy(false);
    }
  }

  function handleCheckout() {
    // В заказ уйдут только ОТМЕЧЕННЫЕ позиции — сохраняем их для /checkout.
    const all = cart?.items ?? [];
    const set = selected ?? new Set(all.map((i) => i.id));
    const ids = all.filter((it) => set.has(it.id)).map((it) => it.id);
    if (ids.length === 0) return;
    try {
      sessionStorage.setItem("checkout_item_ids", JSON.stringify(ids));
    } catch {
      /* приватный режим и т.п. — не критично, оформится вся корзина */
    }
    setCheckingOut(true);
    window.location.href = "/checkout";
  }

  // ── loading ────────────────────────────────────────────────────────────────

  if (fetchStatus === "loading") {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const items = cart?.items ?? [];
  const isEmpty = items.length === 0;

  // Выбор и суммы по отмеченным позициям (итог платит только за них).
  const selectedSet = selected ?? new Set(items.map((i) => i.id));
  const selectedItems = items.filter((it) => selectedSet.has(it.id));
  const allChecked =
    items.length > 0 && selectedItems.length === items.length;
  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const selSubtotal = round2(
    selectedItems.reduce((s, it) => s + round2(it.price * it.qty), 0)
  );
  const selDiscount = cart?.promo
    ? Math.min(round2((selSubtotal * cart.promo.discountPct) / 100), selSubtotal)
    : 0;
  const selTotal = round2(selSubtotal - selDiscount);

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Hero */}
      <section className="relative overflow-hidden py-7 md:py-10">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-600/10 via-neutral-950 to-neutral-950" />
        <div className="absolute top-10 right-20 w-64 h-64 bg-orange-500/8 rounded-full blur-3xl pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-neutral-500 text-sm mb-6">
            <Link href="/" className="hover:text-orange-500 transition-colors">
              Главная
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-neutral-300">Корзина</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-orange-500/20 rounded-xl flex items-center justify-center">
              <ShoppingCart className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white">
                Корзина
              </h1>
              {!isEmpty && (
                <p className="text-neutral-400 text-sm mt-0.5">
                  {items.length}{" "}
                  {items.length === 1
                    ? "позиция"
                    : items.length < 5
                      ? "позиции"
                      : "позиций"}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 pb-20">
        {isEmpty ? (
          <EmptyCart />
        ) : (
          <div className="max-w-5xl mx-auto grid lg:grid-cols-3 gap-8">
            {/* Items */}
            <div className="lg:col-span-2 space-y-3">
              {/* Выбрать все — в заказ уйдут только отмеченные позиции */}
              <label className="flex items-center gap-3 px-1 pb-1 cursor-pointer select-none w-fit">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  className="h-5 w-5 accent-orange-500 shrink-0"
                />
                <span className="text-sm text-neutral-300">
                  Выбрать все{" "}
                  <span className="text-neutral-500">
                    ({selectedItems.length} из {items.length})
                  </span>
                </span>
              </label>

              {items.map((item) => (
                <CartItemRow
                  key={item.id}
                  item={item}
                  onRemove={handleRemove}
                  onUpdateQty={handleUpdate}
                  loading={mutating}
                  checked={selectedSet.has(item.id)}
                  onToggleSelect={toggleSelect}
                />
              ))}

              <div className="flex flex-wrap gap-x-4 gap-y-2 justify-between items-center pt-2">
                <Link href="/catalog">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-neutral-400 hover:text-white"
                  >
                    <ChevronRight className="h-4 w-4 rotate-180" />
                    Продолжить покупки
                  </Button>
                </Link>
                <button
                  onClick={async () => {
                    if (confirm("Очистить корзину?")) {
                      // По одной строке (по id), последовательно — чтобы
                      // параллельные POST'ы не гонялись за итоговой корзиной.
                      for (const i of items) {
                        await handleRemove(i.id);
                      }
                    }
                  }}
                  className="text-xs text-neutral-600 hover:text-red-400 transition-colors flex items-center gap-1 shrink-0 whitespace-nowrap"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Очистить корзину
                </button>
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-4">
              <Card className="border-neutral-800 bg-neutral-900 sticky top-4">
                <CardContent className="p-6">
                  <h2 className="font-bold text-white text-lg mb-5">
                    Итог заказа
                  </h2>

                  <div className="space-y-3 mb-5">
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-400">
                        Товары ({selectedItems.length} поз.)
                      </span>
                      <span className="text-white font-medium">
                        {formatPrice(selSubtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-400">Доставка</span>
                      <span className="text-neutral-500">Рассчитывается</span>
                    </div>
                    {cart?.promo && selDiscount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-green-400 inline-flex items-center gap-1">
                          Скидка ({cart.promo.code}, −{cart.promo.discountPct}%)
                        </span>
                        <span className="text-green-400 font-medium">
                          −{formatPrice(selDiscount)}
                        </span>
                      </div>
                    )}
                    <div className="border-t border-neutral-800 pt-3 flex justify-between">
                      <span className="text-white font-semibold">Итого</span>
                      <span className="text-orange-500 font-bold text-xl">
                        {formatPrice(selTotal)}
                      </span>
                    </div>
                  </div>

                  {/* Промокод */}
                  <div className="mb-5">
                    {cart?.promo ? (
                      <div className="flex items-center justify-between gap-2 rounded-xl border border-green-500/30 bg-green-500/5 px-3 py-2.5">
                        <span className="text-sm text-green-400 inline-flex items-center gap-1.5 min-w-0">
                          <Tag className="h-4 w-4 shrink-0" />
                          <span className="font-mono font-semibold truncate">
                            {cart.promo.code}
                          </span>
                          <span className="text-neutral-400">применён</span>
                        </span>
                        <button
                          onClick={removePromo}
                          disabled={promoBusy}
                          className="text-neutral-400 hover:text-red-400 transition-colors shrink-0 disabled:opacity-50"
                          title="Убрать промокод"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={applyPromo} className="space-y-1.5">
                        <div className="flex gap-2">
                          <input
                            value={promoInput}
                            onChange={(e) => {
                              setPromoInput(e.target.value.toUpperCase());
                              if (promoError) setPromoError(null);
                            }}
                            placeholder="Промокод"
                            maxLength={40}
                            className="flex-1 min-w-0 rounded-xl border border-neutral-700 bg-neutral-800/50 px-3 py-2.5 text-sm text-white font-mono placeholder:font-sans placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none transition-colors"
                          />
                          <Button
                            type="submit"
                            variant="outline"
                            disabled={promoBusy || !promoInput.trim()}
                            className="shrink-0"
                          >
                            {promoBusy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Применить"
                            )}
                          </Button>
                        </div>
                        {promoError && (
                          <p className="text-xs text-red-400">{promoError}</p>
                        )}
                      </form>
                    )}
                  </div>

                  <Button
                    className="w-full gap-2"
                    size="lg"
                    onClick={handleCheckout}
                    disabled={checkingOut || mutating || selectedItems.length === 0}
                  >
                    {checkingOut ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Переходим к оплате…
                      </>
                    ) : (
                      <>
                        Оформить и оплатить
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-neutral-500 text-center mt-4 leading-relaxed">
                    Оплата онлайн картой или через СБП. Также можно оплатить
                    наличными при самовывозе — по телефону.
                  </p>
                  <p className="text-xs text-neutral-500 text-center mt-2 leading-relaxed">
                    Нажимая «Оформить и оплатить», вы принимаете{" "}
                    <Link
                      href="/legal/terms"
                      className="text-orange-400/90 hover:text-orange-300 underline underline-offset-2"
                    >
                      условия оферты
                    </Link>{" "}
                    и даёте{" "}
                    <Link
                      href="/legal/consent"
                      className="text-orange-400/90 hover:text-orange-300 underline underline-offset-2"
                    >
                      согласие на обработку персональных данных
                    </Link>
                    .
                  </p>
                </CardContent>
              </Card>

              {/* Help */}
              <Card className="border-orange-500/20 bg-orange-500/5">
                <CardContent className="p-5">
                  <p className="text-sm font-medium text-white mb-1">
                    Нужна помощь?
                  </p>
                  <p className="text-xs text-neutral-400 mb-3">
                    Наши специалисты помогут подобрать нужные запчасти
                  </p>
                  <a
                    href="tel:+79326006015"
                    className="text-orange-500 font-semibold text-sm hover:text-orange-400 transition-colors flex items-center gap-1.5"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    +7 (932) 600‑60‑15
                  </a>
                  <a
                    href="tel:+73433822062"
                    className="text-orange-500 font-semibold text-sm hover:text-orange-400 transition-colors flex items-center gap-1.5 mt-1.5"
                  >
                    <Phone className="h-3.5 w-3.5" />8 (343) 382‑20‑62
                  </a>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
