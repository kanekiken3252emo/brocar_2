import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { vehicles } from "@/lib/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { toVehicleResponse } from "@/lib/db/serialize";

// Максимум машин в гараже на пользователя (запрос владельца, июль 2026).
// Дублируется в UI (components/garage/GarageClient.tsx MAX_VEHICLES).
const MAX_VEHICLES = 3;

/** Нормализуем VIN: только буквы/цифры, верхний регистр. */
function cleanVin(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return v.length ? v : null;
}

/** GET /api/garage — список машин текущего пользователя (drizzle → наша БД). */
export const GET = withAuth(async (_request, { user }) => {
  try {
    const rows = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.userId, user.id))
      .orderBy(desc(vehicles.createdAt));
    return NextResponse.json({ vehicles: rows.map(toVehicleResponse) });
  } catch (error) {
    console.error("Garage list error:", error);
    return NextResponse.json({ error: "Не удалось загрузить гараж" }, { status: 500 });
  }
});

/** POST /api/garage — добавить машину. */
export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json().catch(() => ({}));

    const year = Number.parseInt(body.year, 10);
    const mileage = Number.parseInt(body.mileage, 10);
    const nickname =
      typeof body.nickname === "string" && body.nickname.trim()
        ? body.nickname.trim()
        : null;
    const brand =
      typeof body.brand === "string" && body.brand.trim() ? body.brand.trim() : null;
    const model =
      typeof body.model === "string" && body.model.trim() ? body.model.trim() : null;
    const vin = cleanVin(body.vin);

    if (!brand && !model && !vin && !nickname) {
      return NextResponse.json(
        { error: "Укажите хотя бы марку, модель или VIN" },
        { status: 400 }
      );
    }

    // Лимит: не более MAX_VEHICLES машин на пользователя.
    const [{ n }] = await db
      .select({ n: count() })
      .from(vehicles)
      .where(eq(vehicles.userId, user.id));
    if (Number(n) >= MAX_VEHICLES) {
      return NextResponse.json(
        { error: `В гараже можно хранить не более ${MAX_VEHICLES} машин` },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(vehicles)
      .values({
        userId: user.id,
        nickname,
        brand,
        model,
        year: Number.isFinite(year) ? year : null,
        vin,
        mileage: Number.isFinite(mileage) ? mileage : null,
      })
      .returning();

    return NextResponse.json({ vehicle: toVehicleResponse(created) });
  } catch (error) {
    console.error("Garage create error:", error);
    return NextResponse.json({ error: "Не удалось сохранить машину" }, { status: 500 });
  }
});
