import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { promoCodes } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { normalizePromoCode } from "@/lib/promo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIELDS = {
  id: promoCodes.id,
  code: promoCodes.code,
  discountPct: promoCodes.discountPct,
  active: promoCodes.active,
  startsAt: promoCodes.startsAt,
  expiresAt: promoCodes.expiresAt,
  createdAt: promoCodes.createdAt,
} as const;

/** Парсит datetime-local / ISO в Date или null. */
function parseDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Список всех промокодов (свежие сверху). */
export async function GET() {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rows = await db
    .select(FIELDS)
    .from(promoCodes)
    .orderBy(desc(promoCodes.createdAt), desc(promoCodes.id));
  return NextResponse.json({ promos: rows });
}

/** Создать промокод. Тело: { code, discountPct, active?, startsAt?, expiresAt? }. */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const code = normalizePromoCode(body?.code);
  const pct = Number(body?.discountPct);

  if (!code) {
    return NextResponse.json({ error: "Укажите код" }, { status: 400 });
  }
  if (!Number.isFinite(pct) || pct < 1 || pct > 100) {
    return NextResponse.json(
      { error: "Процент скидки — число от 1 до 100" },
      { status: 400 }
    );
  }

  const startsAt = parseDate(body?.startsAt);
  const expiresAt = parseDate(body?.expiresAt);
  if (startsAt && expiresAt && expiresAt < startsAt) {
    return NextResponse.json(
      { error: "Дата окончания раньше начала" },
      { status: 400 }
    );
  }

  try {
    const [row] = await db
      .insert(promoCodes)
      .values({
        code,
        discountPct: pct.toString(),
        active: body?.active === false ? false : true,
        startsAt,
        expiresAt,
      })
      .returning(FIELDS);
    return NextResponse.json({ promo: row });
  } catch (e: unknown) {
    // Уникальный индекс по code → код уже существует.
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "Такой промокод уже есть" },
        { status: 409 }
      );
    }
    console.error("Promo create error:", e);
    return NextResponse.json({ error: "Не удалось создать" }, { status: 500 });
  }
}
