import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders as ordersTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/lib/admin";
import { orderStatusMeta } from "@/lib/order-status";
import { settleByPaymentId } from "@/lib/payments/settle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import { PayButton } from "@/components/order/pay-button";
import { AwaitingRefresher } from "@/components/order/awaiting-refresher";
import { ArrowLeft, ArrowRight, Package, CheckCircle2, Clock, XCircle } from "lucide-react";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getUser();
  if (!user) {
    redirect("/auth/login");
  }

  const { id } = await params;
  const orderId = parseInt(id, 10);
  if (isNaN(orderId)) notFound();

  const order = await db.query.orders.findFirst({
    where: eq(ordersTable.id, orderId),
    with: { items: true },
  });

  if (!order) notFound();

  // Доступ: владелец заказа или администратор
  if (order.userId !== user.id && !isAdmin(user)) {
    redirect("/dashboard");
  }

  // Покупатель мог вернуться с формы оплаты раньше, чем пришёл вебхук ЮKassa —
  // активно сверяем статус платежа напрямую с API, чтобы показать корректный
  // экран сразу (а не «ждёт оплаты» по уже оплаченному заказу).
  let status = order.status;
  if (status === "awaiting_payment" && order.paymentId) {
    try {
      const settled = await settleByPaymentId(order.paymentId);
      if (settled.status) status = settled.status;
    } catch (e) {
      console.error(`Order ${orderId}: сверка платежа не удалась`, e);
    }
  }

  const meta = orderStatusMeta(status);

  // Какой экран показать вверху: оплачен / ждёт оплаты / не прошло / ничего.
  // «Спасибо за заказ» показываем только для свежих оплаченных статусов — на
  // заказе, который уже в пути/выдан, это лишнее, остаётся обычный трекинг.
  const PAID_HERO_STATUSES = ["accepted", "awaiting_confirmation", "processing", "paid"];
  const heroKind: "paid" | "awaiting" | "canceled" | null =
    status === "canceled"
      ? "canceled"
      : status === "pending" || status === "awaiting_payment"
        ? "awaiting"
        : PAID_HERO_STATUSES.includes(status)
          ? "paid"
          : null;

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-2 text-neutral-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              К моим заказам
            </Button>
          </Link>

          {/* Экран результата оплаты */}
          {heroKind === "paid" && (
            <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-6 md:p-8">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-9 w-9 text-green-400" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl md:text-3xl font-bold text-white">
                    Спасибо за заказ!
                  </h2>
                  <p className="text-neutral-300 max-w-md mx-auto leading-relaxed">
                    Заказ №{order.id} оплачен и принят в работу. Мы свяжемся с вами для
                    подтверждения деталей. Отслеживать статус можно на этой странице и в
                    личном кабинете.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-center gap-3 pt-1 w-full">
                  <Link href="/dashboard" className="w-full sm:w-auto">
                    <Button className="gap-2 w-full sm:w-auto">
                      В личный кабинет
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/catalog" className="w-full sm:w-auto">
                    <Button variant="outline" className="w-full sm:w-auto">
                      Продолжить покупки
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {heroKind === "awaiting" && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 md:p-8">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                  <Clock className="h-9 w-9 text-amber-400" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl md:text-3xl font-bold text-white">
                    Ожидаем оплату
                  </h2>
                  <p className="text-neutral-300 max-w-md mx-auto leading-relaxed">
                    Если вы уже оплатили — статус обновится автоматически в течение пары
                    минут. Если оплата не завершена, вы можете оплатить заказ прямо сейчас.
                  </p>
                </div>
                <div className="flex flex-col items-center gap-3 pt-1 w-full">
                  <PayButton orderId={order.id} className="w-full sm:w-auto" />
                  <AwaitingRefresher />
                </div>
              </div>
            </div>
          )}

          {heroKind === "canceled" && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 md:p-8">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center">
                  <XCircle className="h-9 w-9 text-red-400" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl md:text-3xl font-bold text-white">
                    Оплата не прошла
                  </h2>
                  <p className="text-neutral-300 max-w-md mx-auto leading-relaxed">
                    Платёж был отменён или не завершён. Товары сохранены в корзине — можно
                    оформить заказ заново.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-center gap-3 pt-1 w-full">
                  <Link href="/cart" className="w-full sm:w-auto">
                    <Button className="gap-2 w-full sm:w-auto">
                      Вернуться в корзину
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/catalog" className="w-full sm:w-auto">
                    <Button variant="outline" className="w-full sm:w-auto">
                      В каталог
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                Заказ №{order.id}
              </h1>
              <p className="text-neutral-400 text-sm mt-1">
                от {new Date(order.createdAt).toLocaleString("ru-RU")}
              </p>
            </div>
            <Badge variant={meta.variant}>{meta.label}</Badge>
          </div>

          <Card className="border-neutral-800 bg-neutral-900">
            <CardHeader className="border-b border-neutral-800">
              <CardTitle className="flex items-center gap-3 text-lg">
                <Package className="h-5 w-5 text-orange-500" />
                Состав заказа
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-neutral-800">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 p-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium leading-snug">
                        {item.name}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <span className="text-xs font-mono bg-neutral-800 text-neutral-300 rounded px-2 py-0.5">
                          {item.article}
                        </span>
                        {item.brand && (
                          <span className="text-xs text-neutral-500 bg-neutral-800 rounded px-2 py-0.5">
                            {item.brand}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <p className="text-neutral-400 text-sm">
                        {item.qty} × {formatPrice(item.price)}
                      </p>
                      <p className="text-white font-semibold">
                        {formatPrice(parseFloat(item.price) * item.qty)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between p-4 border-t border-neutral-800">
                <span className="text-white font-semibold">Итого</span>
                <span className="text-orange-500 font-bold text-xl">
                  {formatPrice(order.total)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
