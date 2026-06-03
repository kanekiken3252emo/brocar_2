/**
 * Проверка прав администратора (владельца магазина).
 * Админы задаются в ADMIN_EMAILS (через запятую) в переменных окружения.
 */

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export function isAdmin(
  user: { email?: string | null } | null | undefined
): boolean {
  return isAdminEmail(user?.email);
}
