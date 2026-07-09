import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import {
  repriceCatalog,
  isRepriceRunning,
  markRepriceStarting,
  readRepriceStatus,
} from "@/lib/markup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Запускает пересчёт цен во всём каталоге под текущую наценку. Пересчёт долгий
 * (минуты, ~2 млн строк), поэтому НЕ ждём его в запросе: стартуем в фоне и сразу
 * отвечаем. Прогресс клиент опрашивает через GET /api/admin/pricing.
 */
export async function POST() {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (isRepriceRunning()) {
    return NextResponse.json(
      { started: false, error: "Пересчёт уже идёт" },
      { status: 409 }
    );
  }

  // Помечаем «running» СИНХРОННО (до запуска фоновой задачи) — иначе статус,
  // прочитанный ниже, ещё показывал бы idle/done, и клиент не начал бы опрос.
  await markRepriceStarting();

  // Fire-and-forget: сервер живёт долго (standalone-контейнер), фоновая задача
  // доработает после ответа. Пересчёт идемпотентен — если контейнер перезагрузят
  // посреди, повторный запуск (или ночной импорт) доведёт цены до конца.
  void repriceCatalog();

  const reprice = await readRepriceStatus();
  return NextResponse.json({ started: true, reprice });
}
