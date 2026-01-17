import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { ShoppingBag, User, Settings, Clock, Package, ArrowRight } from "lucide-react";

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

  const orders: any[] = [];

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Личный кабинет</h1>
              <p className="text-neutral-400">
                Добро пожаловать, <span className="text-orange-500">{user.email?.split('@')[0]}</span>
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/profile">
                <Button variant="outline" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Настройки
                </Button>
              </Link>
              <Link href="/catalog">
                <Button className="gap-2">
                  Каталог
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-neutral-800 bg-neutral-900">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                    <ShoppingBag className="h-6 w-6 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{orders.length}</p>
                    <p className="text-neutral-400 text-sm">Всего заказов</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-neutral-800 bg-neutral-900">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                    <Package className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">0</p>
                    <p className="text-neutral-400 text-sm">В обработке</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-neutral-800 bg-neutral-900">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                    <Clock className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">0</p>
                    <p className="text-neutral-400 text-sm">Доставляется</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Orders */}
          <Card className="border-neutral-800 bg-neutral-900">
            <CardHeader className="border-b border-neutral-800">
              <CardTitle className="flex items-center gap-3">
                <ShoppingBag className="h-5 w-5 text-orange-500" />
                Мои заказы
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {orders.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Package className="h-10 w-10 text-neutral-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">У вас пока нет заказов</h3>
                  <p className="text-neutral-400 mb-6">
                    Начните поиск нужных запчастей в нашем каталоге
                  </p>
                  <Link href="/">
                    <Button size="lg">
                      Начать поиск запчастей
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order: any) => (
                    <div
                      key={order.id}
                      className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4 hover:border-orange-500/50 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-white">
                            Заказ #{order.id}
                          </p>
                          <p className="text-sm text-neutral-400">
                            {new Date(order.createdAt).toLocaleDateString("ru-RU")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-white">
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

          {/* Quick Actions */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border-neutral-800 bg-neutral-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <User className="h-5 w-5 text-orange-500" />
                  Профиль
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-400 mb-4">
                  Управляйте своими личными данными и настройками аккаунта
                </p>
                <Link href="/profile">
                  <Button variant="outline" className="w-full">
                    Редактировать профиль
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-neutral-800 bg-neutral-900">
              <CardHeader>
                <CardTitle className="text-white">Безопасность</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-neutral-800/50 border border-neutral-700 rounded-xl">
                  <div>
                    <p className="font-medium text-white">JWT Токен</p>
                    <p className="text-sm text-neutral-500">
                      Ваша сессия защищена
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    Активен
                  </div>
                </div>
                
                <LogoutButton />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
