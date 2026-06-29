import { readSessionUser } from "./auth/cookies";

/**
 * Текущая сессия (наша cookie с JWT). Возвращаем единый вид { user: {id, email} }.
 */
export async function getSession() {
  const user = await readSessionUser();
  return user ? { user } : null;
}

/**
 * Текущий пользователь (или null). Объект всегда имеет .id и .email — этого
 * достаточно всему коду сайта (isAdmin по email, фильтры по user.id).
 */
export async function getUser() {
  return readSessionUser(); // { id, email } | null
}
