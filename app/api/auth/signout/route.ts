import { NextResponse } from "next/server";
import { isLocalAuth } from "@/lib/auth/config";
import { clearSessionCookie } from "@/lib/auth/cookies";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Выход (legacy-роут; основной — /api/auth/logout). Гасит сессию в ОБОИХ режимах:
 * всегда чистит нашу cookie, а в supabase-режиме — ещё и сессию Supabase. Раньше
 * звал только supabase.signOut() → в local-режиме не разлогинивал.
 */
export async function POST() {
  await clearSessionCookie();

  if (!isLocalAuth()) {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Supabase signout error:", error);
    }
  }

  return NextResponse.json({ message: "Successfully signed out" });
}
