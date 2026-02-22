/**
 * Translates Supabase Auth error messages to Russian.
 * Supabase returns English strings — we map them here.
 */

const ERROR_MAP: Array<[string | RegExp, string]> = [
  // ── Login ───────────────────────────────────────────────────────────────
  ["Invalid login credentials",           "Неверный email или пароль"],
  ["invalid_credentials",                 "Неверный email или пароль"],
  ["Invalid email or password",           "Неверный email или пароль"],
  ["user not found",                      "Аккаунт с таким email не найден"],
  ["User not found",                      "Аккаунт с таким email не найден"],
  ["Email not confirmed",                 "Email не подтверждён — проверьте почту и перейдите по ссылке в письме"],
  ["email not confirmed",                 "Email не подтверждён — проверьте почту и перейдите по ссылке в письме"],

  // ── Register ─────────────────────────────────────────────────────────────
  ["User already registered",             "Аккаунт с таким email уже существует"],
  ["user_already_exists",                 "Аккаунт с таким email уже существует"],
  ["already been registered",             "Аккаунт с таким email уже существует"],
  ["Email already registered",            "Аккаунт с таким email уже существует"],
  ["Signup is disabled",                  "Регистрация временно недоступна"],
  ["signup_disabled",                     "Регистрация временно недоступна"],
  [/Password should be at least/i,        "Пароль должен содержать минимум 6 символов"],
  [/password.*too short/i,               "Пароль слишком короткий — минимум 6 символов"],
  [/weak password/i,                     "Пароль слишком простой — используйте буквы и цифры"],

  // ── Email validation ──────────────────────────────────────────────────────
  [/invalid.*email/i,                    "Неверный формат email"],
  [/unable to validate email/i,          "Неверный формат email"],
  ["email_address_invalid",              "Неверный формат email"],

  // ── Rate limits ───────────────────────────────────────────────────────────
  ["Email rate limit exceeded",          "Слишком много запросов — подождите немного и попробуйте снова"],
  ["over_email_send_rate_limit",         "Слишком много запросов — подождите немного и попробуйте снова"],
  [/too many requests/i,                 "Слишком много попыток — подождите немного"],
  [/rate limit/i,                        "Превышен лимит запросов — попробуйте позже"],
  ["429",                                "Слишком много попыток — подождите немного"],

  // ── Network / server ─────────────────────────────────────────────────────
  [/network/i,                           "Проблема с сетью — проверьте подключение к интернету"],
  [/fetch/i,                             "Не удалось связаться с сервером — попробуйте ещё раз"],
  [/server error/i,                      "Ошибка сервера — попробуйте позже"],
  ["500",                                "Ошибка сервера — попробуйте позже"],
];

export function translateAuthError(message: string, code?: string): string {
  const haystack = `${code ?? ""} ${message}`;

  for (const [pattern, translation] of ERROR_MAP) {
    if (typeof pattern === "string") {
      if (haystack.includes(pattern)) return translation;
    } else {
      if (pattern.test(haystack)) return translation;
    }
  }

  // Fallback — don't show raw English, show generic message
  return "Произошла ошибка — попробуйте ещё раз";
}
