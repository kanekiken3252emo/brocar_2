/**
 * Сессия пользователя — подписанный токен (JWT, HS256) в httpOnly-cookie.
 * Аналог того, что делал Supabase: «помним, что человек вошёл», без похода в БД
 * на каждый запрос. Подпись на секрете AUTH_SECRET — подделать токен нельзя.
 *
 * Модуль НАМЕРЕННО без next/headers и без bcrypt: чистые sign/verify на `jose`,
 * чтобы работать ОДИНАКОВО и в Node (API/страницы), и в Edge (middleware).
 * Чтение/запись самой cookie — в вызывающем коде (lib/auth.ts, middleware.ts).
 */
import { SignJWT, jwtVerify } from "jose";

/** Имя cookie сессии. Отличается от sb-...-auth-token Supabase — пути не пересекаются. */
export const SESSION_COOKIE = "brocar_session";

// 30 дней — как у длинной сессии. Помним достаточно долго, без частых перелогинов.
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export interface SessionUser {
  id: string;
  email: string;
}

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "AUTH_SECRET не задан (или слишком короткий). Сгенерируй: openssl rand -base64 48"
    );
  }
  return new TextEncoder().encode(s);
}

/** Подписывает токен сессии. sub = id пользователя (тот же uuid, что в заказах). */
export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret());
}

/** Проверяет подпись/срок токена. Возвращает пользователя или null (невалиден/истёк). */
export async function verifySessionToken(
  token: string | undefined | null
): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub || typeof payload.email !== "string") return null;
    return { id: payload.sub, email: payload.email };
  } catch {
    // Подпись не сошлась / истёк / мусор — просто «не залогинен».
    return null;
  }
}

/** Опции cookie сессии. secure только на проде (на localhost http — иначе не ставится). */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}
