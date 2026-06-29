/**
 * Требовать подтверждение email перед входом для НОВЫХ регистраций.
 * По умолчанию ВКЛ. Отключить: AUTH_REQUIRE_EMAIL_CONFIRM=false.
 * Перенесённые из Supabase уже подтверждены (email_confirmed_at).
 */
export function requireEmailConfirm(): boolean {
  return process.env.AUTH_REQUIRE_EMAIL_CONFIRM !== "false";
}
