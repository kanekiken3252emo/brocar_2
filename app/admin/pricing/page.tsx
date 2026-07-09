import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ClipboardList,
  Clapperboard,
  Megaphone,
  Tag,
  Percent,
} from "lucide-react";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { readMarkupPct, readRepriceStatus, ensureSettings } from "@/lib/markup";
import AdminPricingManager from "@/components/admin/AdminPricingManager";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Наценка",
  robots: { index: false, follow: false },
};

export default async function AdminPricingPage() {
  const user = await getUser();
  if (!user) redirect("/auth/login");
  if (!isAdmin(user)) redirect("/dashboard");

  await ensureSettings();
  const [pct, reprice] = await Promise.all([
    readMarkupPct(),
    readRepriceStatus(),
  ]);

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Навигация по админке */}
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-neutral-400 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />В личный кабинет
              </Button>
            </Link>
            <Link href="/admin/orders">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-neutral-400 hover:text-white"
              >
                <ClipboardList className="h-4 w-4" />
                Заказы
              </Button>
            </Link>
            <Link href="/admin/stories">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-neutral-400 hover:text-white"
              >
                <Clapperboard className="h-4 w-4" />
                Истории
              </Button>
            </Link>
            <Link href="/admin/news">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-neutral-400 hover:text-white"
              >
                <Megaphone className="h-4 w-4" />
                Новости
              </Button>
            </Link>
            <Link href="/admin/promos">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-neutral-400 hover:text-white"
              >
                <Tag className="h-4 w-4" />
                Промокоды
              </Button>
            </Link>
          </div>

          {/* Заголовок */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-green-500/20 rounded-xl flex items-center justify-center">
              <Percent className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                Наценка
              </h1>
              <p className="text-neutral-400 text-sm">
                Единый процент наценки на весь каталог
              </p>
            </div>
          </div>

          <AdminPricingManager initialPct={pct} initialReprice={reprice} />
        </div>
      </div>
    </div>
  );
}
