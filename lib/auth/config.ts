/**
 * Какой бэкенд авторизации активен — «рубильник» миграции.
 *   AUTH_BACKEND=local    → свои таблицы в VK (этот код)
 *   AUTH_BACKEND=supabase → старый Supabase Auth (по умолчанию)
 *
 * Пока флаг не выставлен в local, весь новый код просто лежит рядом и не
 * участвует в живом входе. Откат = вернуть supabase + перезапуск контейнера.
 */
export function isLocalAuth(): boolean {
  return process.env.AUTH_BACKEND === "local";
}

/**
 * Требовать подтверждение email перед входом для НОВЫХ регистраций.
 * По умолчанию ВКЛ (как было на Supabase). Отключить: AUTH_REQUIRE_EMAIL_CONFIRM=false.
 * Перенесённые из Supabase уже подтверждены (email_confirmed_at) — их не касается.
 */
export function requireEmailConfirm(): boolean {
  return process.env.AUTH_REQUIRE_EMAIL_CONFIRM !== "false";
}
