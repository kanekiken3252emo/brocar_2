import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";

function cleanVin(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return v.length ? v : null;
}

/** PATCH /api/garage/[id] — обновить машину (например, пробег) */
export const PATCH = withAuth(async (request, { user, params }) => {
  const id = Number.parseInt(params?.id, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Некорректный id" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};

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
  updates.updated_at = new Date().toISOString();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id) // защита: только своя машина (плюс RLS)
    .select()
    .single();

  if (error) {
    console.error("Garage update error:", error);
    return NextResponse.json({ error: "Не удалось обновить машину" }, { status: 500 });
  }
  return NextResponse.json({ vehicle: data });
});

/** DELETE /api/garage/[id] — удалить машину */
export const DELETE = withAuth(async (_request, { user, params }) => {
  const id = Number.parseInt(params?.id, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Некорректный id" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("vehicles")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Garage delete error:", error);
    return NextResponse.json({ error: "Не удалось удалить машину" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
});
