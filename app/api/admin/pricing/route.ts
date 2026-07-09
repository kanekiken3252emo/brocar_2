import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import {
  ensureSettings,
  readMarkupPct,
  setMarkupPct,
  isValidPct,
  readRepriceStatus,
} from "@/lib/markup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Текущая наценка + статус последнего пересчёта каталога. */
export async function GET() {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await ensureSettings();
  const [pct, reprice] = await Promise.all([
    readMarkupPct(),
    readRepriceStatus(),
  ]);
  return NextResponse.json({ pct, reprice });
}

/** Сохранить новую наценку. Живые цены карточек обновятся сразу (через кэш);
 *  каталог в БД пересчитывается отдельной кнопкой (см. /apply). */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const pct = typeof body.pct === "number" ? body.pct : parseFloat(body.pct);
  if (!isValidPct(pct)) {
    return NextResponse.json(
      { error: "Наценка должна быть числом от 0 до 300%" },
      { status: 400 }
    );
  }

  await setMarkupPct(pct);
  const reprice = await readRepriceStatus();
  return NextResponse.json({ pct, reprice });
}
