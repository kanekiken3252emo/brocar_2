import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { promoCodes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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

function parseDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function guard() {
  const user = await getUser();
  return Boolean(user && isAdmin(user));
}

/** Обновить промокод (частично). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await guard())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const promoId = parseInt(id, 10);
  if (!Number.isFinite(promoId)) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};

  if (typeof body.code === "string") {
    const code = normalizePromoCode(body.code);
    if (!code) return NextResponse.json({ error: "Пустой код" }, { status: 400 });
    patch.code = code;
  }
  if (body.discountPct !== undefined) {
    const pct = Number(body.discountPct);
    if (!Number.isFinite(pct) || pct < 1 || pct > 100) {
      return NextResponse.json(
        { error: "Процент скидки — число от 1 до 100" },
        { status: 400 }
      );
    }
    patch.discountPct = pct.toString();
  }
  if (typeof body.active === "boolean") patch.active = body.active;
  if ("startsAt" in body) patch.startsAt = parseDate(body.startsAt);
  if ("expiresAt" in body) patch.expiresAt = parseDate(body.expiresAt);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Нечего обновлять" }, { status: 400 });
  }

  try {
    const [row] = await db
      .update(promoCodes)
      .set(patch)
      .where(eq(promoCodes.id, promoId))
      .returning(FIELDS);
    if (!row) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
    return NextResponse.json({ promo: row });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "Такой промокод уже есть" }, { status: 409 });
    }
    console.error("Promo update error:", e);
    return NextResponse.json({ error: "Не удалось обновить" }, { status: 500 });
  }
}

/** Удалить промокод. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await guard())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const promoId = parseInt(id, 10);
  if (!Number.isFinite(promoId)) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }
  await db.delete(promoCodes).where(eq(promoCodes.id, promoId));
  return NextResponse.json({ ok: true });
}
