import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { promoCodes } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import AdminPromoManager, {
  type AdminPromo,
} from "@/components/admin/AdminPromoManager";

export const dynamic = "force-dynamic";

export default async function AdminPromosPage() {
  const user = await getUser();
  if (!user) redirect("/auth/login");
  if (!isAdmin(user)) redirect("/dashboard");

  let initial: AdminPromo[] = [];
  try {
    const rows = await db
      .select({
        id: promoCodes.id,
        code: promoCodes.code,
        discountPct: promoCodes.discountPct,
        active: promoCodes.active,
        startsAt: promoCodes.startsAt,
        expiresAt: promoCodes.expiresAt,
        createdAt: promoCodes.createdAt,
      })
      .from(promoCodes)
      .orderBy(desc(promoCodes.createdAt), desc(promoCodes.id));
    initial = rows.map((r) => ({
      id: r.id,
      code: r.code,
      discountPct: String(r.discountPct),
      active: r.active,
      startsAt: r.startsAt ? r.startsAt.toISOString() : null,
      expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch (e) {
    // Таблицы может ещё не быть (миграция не прогнана) — покажем пустой список.
    console.error("admin/promos load error:", e);
    initial = [];
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-orange-400 transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          К заказам
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
          Промокоды
        </h1>
        <p className="text-neutral-400 mb-6 text-sm leading-relaxed">
          Создавай коды со скидкой в процентах и сроком действия. Покупатель
          вводит код в корзине — сумма пересчитывается. Скидка применяется и
          проверяется на сервере при оформлении заказа. «Выключить» ⏻ мгновенно
          отключает код, не удаляя его.
        </p>
        <AdminPromoManager initialPromos={initial} />
      </div>
    </div>
  );
}
