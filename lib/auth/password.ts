/**
 * Пароли. bcrypt — тот же алгоритм, которым шифрует Supabase Auth, поэтому
 * ПЕРЕНЕСЁННЫЕ хеши проверяются как есть: старые пароли продолжают подходить.
 *
 * bcryptjs — чистый JS (без нативной сборки), безопасно работает в Docker.
 * Только Node-окружение (API-роуты), НЕ middleware/Edge.
 */
import bcrypt from "bcryptjs";

// 10 раундов — дефолт bcrypt и Supabase. Баланс «безопасно / не тормозит вход».
const ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

/** Проверяет пароль против bcrypt-хеша (в т.ч. перенесённого из Supabase, $2a$/$2b$). */
export async function verifyPassword(
  plain: string,
  hash: string | null | undefined
): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
