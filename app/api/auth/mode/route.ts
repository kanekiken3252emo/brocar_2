import { NextResponse } from "next/server";
import { isLocalAuth } from "@/lib/auth/config";

export const dynamic = "force-dynamic";

/**
 * Текущий режим авторизации для КЛИЕНТА. Читается в рантайме (process.env на
 * сервере), поэтому переключение AUTH_BACKEND применяется сразу после перезапуска
 * контейнера — без пересборки и без NEXT_PUBLIC-флага (тот «впекается» на сборке).
 * Клиентские действия (lib/auth/client-actions) спрашивают этот эндпоинт.
 */
export async function GET() {
  return NextResponse.json(
    { backend: isLocalAuth() ? "local" : "supabase" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
