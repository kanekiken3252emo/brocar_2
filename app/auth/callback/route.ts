import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publicBaseUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

/**
 * Callback после подтверждения email (или OAuth): Supabase редиректит сюда с
 * ?code=... Мы обмениваем код на сессию (ставим куки) и ведём на главную —
 * пользователь оказывается уже залогиненным.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const baseUrl = publicBaseUrl(request);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${baseUrl}/?welcome=1`);
    }
  }

  // Не удалось (например, ссылку открыли в другом браузере, где нет PKCE-куки) —
  // email всё равно подтверждён, просто просим войти.
  return NextResponse.redirect(`${baseUrl}/auth/login?confirmed=1`);
}
