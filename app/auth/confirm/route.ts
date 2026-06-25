import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publicBaseUrl } from "@/lib/site-url";
import { isLocalAuth } from "@/lib/auth/config";
import { hashToken } from "@/lib/auth/tokens";
import {
  findValidToken,
  markTokenUsed,
  confirmUserEmail,
  findUserById,
} from "@/lib/auth/users";
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Подтверждение email по ссылке из письма регистрации.
 *
 * local: наш одноразовый токен (?token=) — подтверждаем email, сразу логиним
 *   (ссылку открыл владелец почты) и ведём на главную.
 * supabase (как было): token_hash + verifyOtp.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const baseUrl = publicBaseUrl(request);

  if (isLocalAuth()) {
    const token = searchParams.get("token");
    if (token) {
      const row = await findValidToken(hashToken(token), "confirm");
      if (row) {
        await confirmUserEmail(row.userId);
        await markTokenUsed(row.id);
        const user = await findUserById(row.userId);
        const res = NextResponse.redirect(`${baseUrl}/?welcome=1`);
        if (user) {
          const jwt = await createSessionToken({
            id: user.id,
            email: user.email,
          });
          res.cookies.set(SESSION_COOKIE, jwt, sessionCookieOptions());
        }
        return res;
      }
    }
    // Нет токена / просрочен / уже использован — ведём на вход с пометкой.
    return NextResponse.redirect(`${baseUrl}/auth/login?confirmed=0`);
  }

  // ── Supabase (token_hash работает на любом устройстве, в отличие от PKCE) ──
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
