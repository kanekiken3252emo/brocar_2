import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";

async function getOrders(userId: string) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_DOMAIN || "http://localhost:3000"}/api/order`,
      {
        headers: {
          Cookie: `sb-access-token=${userId}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.orders || [];
  } catch (error) {
    console.error("Error fetching orders:", error);
    return [];
  }
}

export default async function DashboardPage() {
  const user = await getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Note: In production, you'd fetch actual orders using the API
  const orders: any[] = []; // await getOrders(user.id);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold">Личный кабинет</h1>
          <p className="text-gray-600 mt-2">
            Email: {user.email}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Мои заказы</CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">
                  У вас пока нет заказов
                </p>
                <Link href="/">
                  <Button>Начать поиск запчастей</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order: any) => (
                  <div
                    key={order.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">
                          Заказ #{order.id}
                        </p>
                        <p className="text-sm text-gray-600">
                          {new Date(order.createdAt).toLocaleDateString("ru-RU")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {formatPrice(order.total)}
                        </p>
                        <Badge
                          variant={
                            order.status === "paid"
                              ? "success"
                              : order.status === "canceled"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                    <Link href={`/order/${order.id}`}>
                      <Button variant="outline" size="sm" className="mt-3">
                        Подробнее
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Действия</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <form action="/auth/signout" method="post">
              <Button variant="outline" type="submit" className="w-full">
                Выйти из системы
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}




