import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

/** Выход (legacy-роут; основной — /api/auth/logout). Чистит cookie сессии. */
export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ message: "Successfully signed out" });
}
