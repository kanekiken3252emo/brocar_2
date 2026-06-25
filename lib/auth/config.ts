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
