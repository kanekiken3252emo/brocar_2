import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders as ordersTable, vehicles as vehiclesTable } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import GarageClient, {
  type GarageVehicle,
  type PurchasedPart,
} from "@/components/garage/GarageClient";

export const dynamic = "force-dynamic";

export default async function GaragePage() {
  const user = await getUser();

  // Гостю показываем гараж, но кнопка «Добавить» ведёт на регистрацию.
  if (!user) {
    return (
      <GarageClient
        initialVehicles={[]}
        purchased={[]}
        isAuthenticated={false}
      />
    );
  }

  // Машины пользователя. Если таблицы ещё нет (миграция не применена) —
  // не падаем, а показываем пустой гараж.
  let cars: Awaited<ReturnType<typeof db.query.vehicles.findMany>> = [];
  try {
    cars = await db.query.vehicles.findMany({
      where: eq(vehiclesTable.userId, user.id),
      orderBy: [desc(vehiclesTable.createdAt)],
    });
  } catch (e) {
    console.error("Гараж: таблица vehicles недоступна — примените миграцию", e);
  }

  const vehicles: GarageVehicle[] = cars.map((v) => ({
    id: v.id,
    nickname: v.nickname,
    brand: v.brand,
    model: v.model,
    year: v.year,
    vin: v.vin,
    mileage: v.mileage,
  }));

  // История покупок — детали из заказов пользователя (без отменённых)
  const userOrders = await db.query.orders.findMany({
    where: eq(ordersTable.userId, user.id),
    with: { items: true },
    orderBy: [desc(ordersTable.createdAt)],
  });

  // Дедуп по (артикул+бренд): оставляем самую свежую покупку
  const partMap = new Map<string, PurchasedPart>();
  for (const o of userOrders) {
    if (o.status === "canceled") continue;
    for (const it of o.items) {
      const key = `${it.brand ?? ""}|${it.article}`.toLowerCase();
      if (!partMap.has(key)) {
        partMap.set(key, {
          name: it.name,
          article: it.article,
          brand: it.brand,
          date: o.createdAt.toISOString(),
        });
      }
    }
  }
  const purchased = Array.from(partMap.values());

  return (
    <GarageClient
      initialVehicles={vehicles}
      purchased={purchased}
      isAuthenticated
    />
  );
}
