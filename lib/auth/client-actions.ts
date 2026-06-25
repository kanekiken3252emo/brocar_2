/**
 * Клиентские действия авторизации — ЕДИНАЯ точка развилки supabase ↔ local.
 * Страницы входа/регистрации/сброса зовут эти функции и не знают, какой бэкенд
 * активен. Режим узнаём в РАНТАЙМЕ у сервера (/api/auth/mode) — поэтому
 * переключение AUTH_BACKEND срабатывает сразу после перезапуска контейнера,
 * без пересборки. Ответ кешируем на время жизни вкладки.
 *
 * supabase-клиент импортируется ЛЕНИВО (только когда реально нужен), чтобы
 * тяжёлый supabase-js не попадал в бандл в local-режиме.
 */
import { translateAuthError } from "@/lib/auth-errors";

type Backend = "local" | "supabase";

let backendPromise: Promise<Backend> | null = null;

/** Текущий режим (кешируется). При сбое — supabase (текущий дефолт, безопасно). */
export function getBackend(): Promise<Backend> {
  if (!backendPromise) {
    backendPromise = fetch("/api/auth/mode")
      .then((r) => (r.ok ? r.json() : { backend: "supabase" }))
      .then((d): Backend => (d?.backend === "local" ? "local" : "supabase"))
      .catch((): Backend => "supabase");
  }
  return backendPromise;
}

// Прогреваем режим заранее (на импорт модуля страницей), чтобы первый клик не
// ждал лишний round-trip.
if (typeof window !== "undefined") void getBackend();

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
  if ((await getBackend()) === "local") {
    const { res, data } = await postJson("/api/auth/login", { email, password });
    return res.ok ? {} : { error: data.error || "Не удалось войти" };
  }

  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? { error: translateAuthError(error.message, error.code) } : {};
}

/**
 * Регистрация. session=true → пользователь уже вошёл (подтверждение email
 * выключено); session=false → нужно подтвердить email перед входом.
 */
export async function signUp(
  email: string,
  password: string
): Promise<{ error?: string; session?: boolean }> {
  if ((await getBackend()) === "local") {
    const { res, data } = await postJson("/api/auth/register", {
      email,
      password,
    });
    if (!res.ok)
      return { error: data.error || "Не удалось зарегистрироваться" };
    return { session: !!data.session };
  }

  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  });
  if (error) return { error: translateAuthError(error.message, error.code) };
  // При включённом подтверждении Supabase не отдаёт ошибку для существующего
  // адреса (защита от перебора), но identities приходит пустым.
  if (data.user && (data.user.identities?.length ?? 0) === 0)
    return { error: "Аккаунт с таким email уже существует" };
  return { session: !!data.session };
}

/** Запрос письма со ссылкой сброса пароля. */
export async function requestPasswordReset(
  email: string
): Promise<{ error?: string }> {
  if ((await getBackend()) === "local") {
    const { res, data } = await postJson("/api/auth/forgot-password", { email });
    return res.ok
      ? {}
      : { error: data.error || "Не удалось отправить письмо — попробуйте ещё раз" };
  }

  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });
  return error ? { error: translateAuthError(error.message, error.code) } : {};
}

/**
 * Установка нового пароля по ссылке из письма.
 * local: токен берём из URL (?token=) и шлём на сервер.
 * supabase: токен не нужен — recovery-сессия подхватывается из URL самим
 * supabase-js, пароль ставим через updateUser.
 */
export async function updatePasswordWithToken(
  password: string,
  token: string | null
): Promise<{ error?: string; expired?: boolean }> {
  if ((await getBackend()) === "local") {
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

  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (!error) return {};
  const msg = (error.message ?? "").toLowerCase();
  if (msg.includes("session") || msg.includes("missing") || msg.includes("jwt")) {
    return {
      error:
        "Ссылка недействительна или устарела. Запросите письмо для сброса заново.",
      expired: true,
    };
  }
  return { error: translateAuthError(error.message, error.code) };
}

/** Выход. */
export async function signOut(): Promise<void> {
  if ((await getBackend()) === "local") {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    return;
  }
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  await supabase.auth.signOut();
}
