import { NextResponse, type NextRequest } from "next/server";
import { publicBaseUrl } from "@/lib/site-url";
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
 * Подтверждение email по ссылке из письма регистрации (?token=). По одноразовому
 * токену подтверждаем email, сразу логиним (ссылку открыл владелец почты) и ведём
 * на главную.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const baseUrl = publicBaseUrl(request);
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
