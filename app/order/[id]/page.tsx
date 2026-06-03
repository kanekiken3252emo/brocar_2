import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders as ordersTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/lib/admin";
import { orderStatusMeta } from "@/lib/order-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import { ArrowLeft, Package } from "lucide-react";

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

  const meta = orderStatusMeta(order.status);

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
