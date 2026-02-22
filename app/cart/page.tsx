"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
} from "lucide-react";

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
  product: CartProduct;
}

interface CartData {
  id?: number;
  items: CartItem[];
  subtotal: number;
  total: number;
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
  return res.json() as Promise<CartData>;
}

// ─── empty state ──────────────────────────────────────────────────────────────

function EmptyCart() {
  return (
    <div className="flex flex-col items-center text-center py-20 px-4">
      <div className="w-24 h-24 bg-neutral-900 border border-neutral-800 rounded-3xl flex items-center justify-center mb-6">
        <PackageOpen className="h-10 w-10 text-neutral-600" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-3">Корзина пуста</h2>
      <p className="text-neutral-400 max-w-sm mb-8 leading-relaxed">
        Добавьте запчасти из каталога или оформите запрос по VIN‑коду —
        мы подберём нужные детали.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <Link href="/catalog" className="flex-1">
          <Button className="w-full gap-2">
            <Search className="h-4 w-4" />
            Каталог
          </Button>
        </Link>
        <Link href="/vin-search" className="flex-1">
          <Button variant="outline" className="w-full gap-2">
            <Car className="h-4 w-4" />
            Запрос по VIN
          </Button>
        </Link>
      </div>

      {/* Hints */}
      <div className="grid sm:grid-cols-3 gap-4 mt-14 w-full max-w-2xl">
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
            desc: "Специалисты помогут с выбором: +7 (932) 600‑60‑52",
          },
        ].map((h) => (
          <div
            key={h.title}
            className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 text-left hover:border-orange-500/30 transition-colors"
          >
            <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center mb-3">
              {h.icon}
            </div>
            <p className="font-semibold text-white text-sm mb-1">{h.title}</p>
            <p className="text-neutral-400 text-xs leading-relaxed">{h.desc}</p>
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
}: {
  item: CartItem;
  onRemove: (id: number) => void;
  onUpdateQty: (id: number, qty: number) => void;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 p-5 bg-neutral-900 border border-neutral-800 rounded-2xl hover:border-neutral-700 transition-colors">
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
        </div>
        <p className="text-white font-medium leading-snug">{item.product.name}</p>
        <p className="text-orange-500 font-bold text-lg mt-1">
          {formatPrice(item.product.price)}
        </p>
      </div>

      {/* Qty + remove */}
      <div className="flex items-center gap-3 sm:flex-col sm:items-end justify-between sm:justify-start">
        {/* Quantity */}
        <div className="flex items-center gap-2 bg-neutral-800 border border-neutral-700 rounded-xl p-1">
          <button
            onClick={() => onUpdateQty(item.productId, item.qty - 1)}
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
            onClick={() => onUpdateQty(item.productId, item.qty + 1)}
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
            {formatPrice(item.product.price * item.qty)}
          </p>
          <button
            onClick={() => onRemove(item.productId)}
            disabled={loading}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-600 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors"
            aria-label="Удалить"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function CartPage() {
  const [cart, setCart] = useState<CartData | null>(null);
  const [fetchStatus, setFetchStatus] = useState<"loading" | "ok" | "error">("loading");
  const [mutating, setMutating] = useState(false);

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

  async function handleUpdate(productId: number, qty: number) {
    setMutating(true);
    try {
      const data = await apiCart({ action: "update", productId, qty });
      setCart(data);
    } catch {
      /* ignore */
    } finally {
      setMutating(false);
    }
  }

  async function handleRemove(productId: number) {
    setMutating(true);
    try {
      const data = await apiCart({ action: "remove", productId });
      setCart(data);
    } catch {
      /* ignore */
    } finally {
      setMutating(false);
    }
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

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Hero */}
      <section className="relative overflow-hidden py-12 md:py-16">
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
              <h1 className="text-3xl md:text-4xl font-bold text-white">Корзина</h1>
              {!isEmpty && (
                <p className="text-neutral-400 text-sm mt-0.5">
                  {items.length}{" "}
                  {items.length === 1 ? "позиция" : items.length < 5 ? "позиции" : "позиций"}
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
              {items.map((item) => (
                <CartItemRow
                  key={item.id}
                  item={item}
                  onRemove={handleRemove}
                  onUpdateQty={handleUpdate}
                  loading={mutating}
                />
              ))}

              <div className="flex justify-between items-center pt-2">
                <Link href="/catalog">
                  <Button variant="ghost" size="sm" className="gap-2 text-neutral-400 hover:text-white">
                    <ChevronRight className="h-4 w-4 rotate-180" />
                    Продолжить покупки
                  </Button>
                </Link>
                <button
                  onClick={() => {
                    if (confirm("Очистить корзину?")) {
                      items.forEach((i) => handleRemove(i.productId));
                    }
                  }}
                  className="text-xs text-neutral-600 hover:text-red-400 transition-colors flex items-center gap-1"
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
                  <h2 className="font-bold text-white text-lg mb-5">Итог заказа</h2>

                  <div className="space-y-3 mb-5">
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-400">Товары ({items.length} поз.)</span>
                      <span className="text-white font-medium">{formatPrice(cart?.subtotal ?? 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-400">Доставка</span>
                      <span className="text-neutral-500">Рассчитывается</span>
                    </div>
                    <div className="border-t border-neutral-800 pt-3 flex justify-between">
                      <span className="text-white font-semibold">Итого</span>
                      <span className="text-orange-500 font-bold text-xl">
                        {formatPrice(cart?.total ?? 0)}
                      </span>
                    </div>
                  </div>

                  <Button className="w-full gap-2" size="lg">
                    Оформить заказ
                    <ArrowRight className="h-4 w-4" />
                  </Button>

                  <p className="text-xs text-neutral-500 text-center mt-4 leading-relaxed">
                    Оформление заказа и оплата — по звонку или в магазине
                  </p>
                </CardContent>
              </Card>

              {/* Help */}
              <Card className="border-orange-500/20 bg-orange-500/5">
                <CardContent className="p-5">
                  <p className="text-sm font-medium text-white mb-1">Нужна помощь?</p>
                  <p className="text-xs text-neutral-400 mb-3">
                    Наши специалисты помогут подобрать нужные запчасти
                  </p>
                  <a href="tel:+79326006052" className="text-orange-500 font-semibold text-sm hover:text-orange-400 transition-colors flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    +7 (932) 600‑60‑52
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
