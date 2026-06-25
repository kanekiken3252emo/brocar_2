/**
 * Чтение/запись cookie сессии на сервере (next/headers). Server-only —
 * НЕ для middleware (там свой доступ через request/response в middleware.ts).
 */
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  createSessionToken,
  verifySessionToken,
  type SessionUser,
} from "./session";

/** Залогинить: подписать токен и положить в httpOnly-cookie. */
export async function setSessionCookie(user: SessionUser): Promise<void> {
  const token = await createSessionToken(user);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions());
}

/** Разлогинить: затереть cookie. */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
}

/** Достать пользователя из cookie сессии (или null). */
export async function readSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}
