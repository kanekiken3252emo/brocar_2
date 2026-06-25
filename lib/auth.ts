import { createClient } from "./supabase/server";
import { isLocalAuth } from "./auth/config";
import { readSessionUser } from "./auth/cookies";

/**
 * Текущая сессия. В local-режиме — наша cookie (JWT), в supabase-режиме —
 * сессия Supabase. Возвращаем единый минимальный вид { user: {id, email} }.
 */
export async function getSession() {
  if (isLocalAuth()) {
    const user = await readSessionUser();
    return user ? { user } : null;
  }

  const supabase = await createClient();
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session;
  } catch (error) {
    console.error("Error getting session:", error);
    return null;
  }
}

/**
 * Текущий пользователь (или null). Объект всегда имеет .id и .email — этого
 * достаточно всему коду сайта (isAdmin по email, фильтры по user.id).
 */
export async function getUser() {
  if (isLocalAuth()) {
    return readSessionUser(); // { id, email } | null
  }

  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    console.error("Error getting user:", error);
    return null;
  }
}
