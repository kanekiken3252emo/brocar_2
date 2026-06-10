import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";

/** Нормализуем VIN: только буквы/цифры, верхний регистр. */
function cleanVin(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return v.length ? v : null;
}

/** GET /api/garage — список машин текущего пользователя */
export const GET = withAuth(async (_request, { user }) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Garage list error:", error);
    return NextResponse.json({ error: "Не удалось загрузить гараж" }, { status: 500 });
  }
  return NextResponse.json({ vehicles: data ?? [] });
});

/** POST /api/garage — добавить машину */
export const POST = withAuth(async (request, { user }) => {
  const body = await request.json().catch(() => ({}));

  const year = Number.parseInt(body.year, 10);
  const mileage = Number.parseInt(body.mileage, 10);

  const insert = {
    user_id: user.id,
    nickname: typeof body.nickname === "string" && body.nickname.trim() ? body.nickname.trim() : null,
    brand: typeof body.brand === "string" && body.brand.trim() ? body.brand.trim() : null,
    model: typeof body.model === "string" && body.model.trim() ? body.model.trim() : null,
    year: Number.isFinite(year) ? year : null,
    vin: cleanVin(body.vin),
    mileage: Number.isFinite(mileage) ? mileage : null,
  };

  if (!insert.brand && !insert.model && !insert.vin && !insert.nickname) {
    return NextResponse.json(
      { error: "Укажите хотя бы марку, модель или VIN" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .insert(insert)
    .select()
    .single();

  if (error) {
    console.error("Garage create error:", error);
    return NextResponse.json({ error: "Не удалось сохранить машину" }, { status: 500 });
  }
  return NextResponse.json({ vehicle: data });
});
