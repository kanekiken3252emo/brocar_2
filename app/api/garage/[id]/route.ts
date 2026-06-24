import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { vehicles } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { toVehicleResponse } from "@/lib/db/serialize";

function cleanVin(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return v.length ? v : null;
}

/** PATCH /api/garage/[id] — обновить машину (например, пробег). Только свою. */
export const PATCH = withAuth(async (request, { user, params }) => {
  const id = Number.parseInt(params?.id, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Некорректный id" }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const updates: Partial<typeof vehicles.$inferInsert> = {};

    if (body.nickname !== undefined)
      updates.nickname = body.nickname?.trim() || null;
    if (body.brand !== undefined) updates.brand = body.brand?.trim() || null;
    if (body.model !== undefined) updates.model = body.model?.trim() || null;
    if (body.year !== undefined) {
      const y = Number.parseInt(body.year, 10);
      updates.year = Number.isFinite(y) ? y : null;
    }
    if (body.vin !== undefined) updates.vin = cleanVin(body.vin);
    if (body.mileage !== undefined) {
      const m = Number.parseInt(body.mileage, 10);
      updates.mileage = Number.isFinite(m) ? m : null;
    }
    updates.updatedAt = new Date();

    // Фильтр по userId — ЕДИНСТВЕННАЯ защита «только своя машина»: на VK нет RLS.
    const [updated] = await db
      .update(vehicles)
      .set(updates)
      .where(and(eq(vehicles.id, id), eq(vehicles.userId, user.id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Машина не найдена" }, { status: 404 });
    }
    return NextResponse.json({ vehicle: toVehicleResponse(updated) });
  } catch (error) {
    console.error("Garage update error:", error);
    return NextResponse.json({ error: "Не удалось обновить машину" }, { status: 500 });
  }
});

/** DELETE /api/garage/[id] — удалить машину. Только свою. */
export const DELETE = withAuth(async (_request, { user, params }) => {
  const id = Number.parseInt(params?.id, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Некорректный id" }, { status: 400 });
  }

  try {
    // Фильтр по userId — единственная защита «только своя машина» (RLS на VK нет).
    await db
      .delete(vehicles)
      .where(and(eq(vehicles.id, id), eq(vehicles.userId, user.id)));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Garage delete error:", error);
    return NextResponse.json({ error: "Не удалось удалить машину" }, { status: 500 });
  }
});
