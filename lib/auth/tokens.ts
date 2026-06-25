/**
 * Одноразовые токены для писем (подтверждение email, сброс пароля).
 *
 * В ссылку из письма кладём СЫРОЙ токен, а в БД (auth_tokens.token_hash) —
 * только его sha256. Поэтому утечка БД не даёт сбросить пароль, а проверка —
 * это сравнение хешей. Node-окружение (crypto), используется в API-роутах.
 */
import { randomBytes, createHash } from "node:crypto";

/** Срок жизни ссылки сброса пароля — 1 час. */
export const TOKEN_TTL_MS = 60 * 60 * 1000;

/** Срок жизни ссылки подтверждения email — 24 часа (письмо могут открыть не сразу). */
export const CONFIRM_TTL_MS = 24 * 60 * 60 * 1000;

/** Генерирует криптослучайный токен для ссылки (url-safe, ~43 символа). */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** sha256-хеш токена (то, что кладём в БД). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
