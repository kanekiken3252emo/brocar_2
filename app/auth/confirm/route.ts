import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publicBaseUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

/**
 * Подтверждение email через token_hash (работает на любом устройстве, в отличие
 * от PKCE-кода). Используется, если в шаблоне письма Supabase ссылка ведёт на
 * /auth/confirm?token_hash=...&type=signup. Ставим сессию и ведём на главную.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const baseUrl = publicBaseUrl(request);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(`${baseUrl}/?welcome=1`);
    }
  }

  return NextResponse.redirect(`${baseUrl}/auth/login?confirmed=1`);
}
