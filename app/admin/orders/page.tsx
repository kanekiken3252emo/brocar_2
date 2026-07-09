import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { orders as ordersTable, profiles } from "@/lib/db/schema";
import { count, desc, inArray } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ClipboardList, Clapperboard, Megaphone, Tag, Percent } from "lucide-react";
import AdminOrdersList from "@/components/admin/AdminOrdersList";

export const dynamic = "force-dynamic";

// Грузим последние N заказов, а не весь безграничный массив (с items+профилями)
// в память и на клиент. Точное «всего» считаем отдельным дешёвым COUNT(*), так
// что шапка остаётся честной даже при отсечке. ORDER BY created_at идёт по
// idx_orders_created_at, join позиций — по idx_order_items_order_id.
const ADMIN_ORDERS_LIMIT = 500;

export default async function AdminOrdersPage() {
  const user = await getUser();
  if (!user) redirect("/auth/login");
  if (!isAdmin(user)) redirect("/dashboard");

  const [allOrders, totalRow] = await Promise.all([
    db.query.orders.findMany({
      with: { items: true },
      orderBy: [desc(ordersTable.createdAt)],
      limit: ADMIN_ORDERS_LIMIT,
    }),
    db.select({ c: count() }).from(ordersTable),
  ]);
  const totalOrders = Number(totalRow[0]?.c ?? allOrders.length);
  const capped = totalOrders > allOrders.length;

  const userIds = Array.from(new Set(allOrders.map((o) => o.userId)));
  const profs = userIds.length
    ? await db.query.profiles.findMany({
        where: inArray(profiles.id, userIds),
      })
    : [];
  const profMap = new Map(profs.map((p) => [p.id, p]));

  const data = allOrders.map((o) => {
    const p = profMap.get(o.userId);
    return {
      id: o.id,
      status: o.status,
      total: o.total,
      paymentId: o.paymentId,
      createdAt: o.createdAt.toISOString(),
      customer: {
        email: p?.email ?? null,
        fullName: p?.fullName ?? null,
        phone: p?.phone ?? null,
        contactEmail: p?.contactEmail ?? null,
        telegram: p?.telegram ?? null,
        whatsapp: p?.whatsapp ?? null,
        vk: p?.vk ?? null,
        maxMessenger: p?.maxMessenger ?? null,
      },
      items: o.items.map((it) => ({
        id: it.id,
        name: it.name,
        article: it.article,
        brand: it.brand,
        qty: it.qty,
        price: it.price,
      })),
    };
  });

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="gap-2 text-neutral-400 hover:text-white">
                <ArrowLeft className="h-4 w-4" />
                В личный кабинет
              </Button>
            </Link>
            <Link href="/admin/stories">
              <Button variant="ghost" size="sm" className="gap-2 text-neutral-400 hover:text-white">
                <Clapperboard className="h-4 w-4" />
                Истории
              </Button>
            </Link>
            <Link href="/admin/news">
              <Button variant="ghost" size="sm" className="gap-2 text-neutral-400 hover:text-white">
                <Megaphone className="h-4 w-4" />
                Новости
              </Button>
            </Link>
            <Link href="/admin/promos">
              <Button variant="ghost" size="sm" className="gap-2 text-neutral-400 hover:text-white">
                <Tag className="h-4 w-4" />
                Промокоды
              </Button>
            </Link>
            <Link href="/admin/pricing">
              <Button variant="ghost" size="sm" className="gap-2 text-neutral-400 hover:text-white">
                <Percent className="h-4 w-4" />
                Наценка
              </Button>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                Заказы магазина
              </h1>
              <p className="text-neutral-400 text-sm">
                Всего заказов: {totalOrders}
                {capped && (
                  <span className="text-neutral-500">
                    {" "}· показаны последние {ADMIN_ORDERS_LIMIT}
                  </span>
                )}
              </p>
            </div>
          </div>

          <AdminOrdersList orders={data} />
        </div>
      </div>
    </div>
  );
}
