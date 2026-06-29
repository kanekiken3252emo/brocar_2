/**
 * Клиентские действия авторизации — вызываются страницами входа/регистрации/
 * сброса. Все идут через наши API-роуты /api/auth/*.
 */

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/** Вход. Возвращает { error } при неудаче. */
export async function signIn(
  email: string,
  password: string
): Promise<{ error?: string }> {
  const { res, data } = await postJson("/api/auth/login", { email, password });
  return res.ok ? {} : { error: data.error || "Не удалось войти" };
}

/**
 * Регистрация. session=true → пользователь уже вошёл (подтверждение email
 * выключено); session=false → нужно подтвердить email перед входом.
 */
export async function signUp(
  email: string,
  password: string
): Promise<{ error?: string; session?: boolean }> {
  const { res, data } = await postJson("/api/auth/register", { email, password });
  if (!res.ok) return { error: data.error || "Не удалось зарегистрироваться" };
  return { session: !!data.session };
}

/** Запрос письма со ссылкой сброса пароля. */
export async function requestPasswordReset(
  email: string
): Promise<{ error?: string }> {
  const { res, data } = await postJson("/api/auth/forgot-password", { email });
  return res.ok
    ? {}
    : { error: data.error || "Не удалось отправить письмо — попробуйте ещё раз" };
}

/**
 * Установка нового пароля по ссылке из письма. Токен берём из URL (?token=).
 */
export async function updatePasswordWithToken(
  password: string,
  token: string | null
): Promise<{ error?: string; expired?: boolean }> {
  if (!token)
    return {
      error:
        "Ссылка недействительна или устарела. Запросите письмо для сброса заново.",
      expired: true,
    };
  const { res, data } = await postJson("/api/auth/reset-password", {
    token,
    password,
  });
  if (res.ok) return {};
  return {
    error: data.error || "Не удалось обновить пароль",
    expired: res.status === 400,
  };
}

/** Выход. */
export async function signOut(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
}
