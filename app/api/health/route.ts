import { NextRequest, NextResponse } from "next/server";
import { client } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Проверка живости. Без параметров — как раньше, только процесс (для быстрых
 * проверок деплоя). С ?deep=1 — дополнительно пингует БД с таймаутом 5с:
 * если пул соединений исчерпан или БД встала, вернёт 503 с причиной. Именно
 * этот режим дёргает ежеминутный монитор (scripts/health-monitor.sh) — чтобы
 * отличать «умер контейнер» от «жив, но БД/пул мёртв» (сайт при этом белый).
 */
export async function GET(request: NextRequest) {
  const base = { ok: true, timestamp: new Date().toISOString() };
  if (request.nextUrl.searchParams.get("deep") !== "1") {
    return NextResponse.json(base);
  }

  const t0 = Date.now();
  try {
    await Promise.race([
      client`SELECT 1`,
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("db timeout/queue >5s")), 5000)
      ),
    ]);
    return NextResponse.json({ ...base, db: { ok: true, ms: Date.now() - t0 } });
  } catch (e) {
    return NextResponse.json(
      {
        ...base,
        ok: false,
        db: { ok: false, ms: Date.now() - t0, error: (e as Error).message },
      },
      { status: 503 }
    );
  }
}
