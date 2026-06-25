/**
 * Анти-брутфорс для входа: лимит неудачных попыток в памяти процесса.
 *
 * Ключ = IP + email. После MAX_FAILURES неудач подряд — блок на BLOCK_MS.
 * Успешный вход сбрасывает счётчик. Привязка к IP атакующего означает, что
 * залочить ЧУЖОЙ аккаунт со стороны нельзя (у жертвы другой IP → другой ключ).
 *
 * Хранилище — Map в памяти (у нас 1 контейнер). При рестарте/деплое обнуляется —
 * для нашего масштаба приемлемо. Если когда-то будет несколько инстансов —
 * заменить на общий стор (Redis/БД).
 */
const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000; // окно подсчёта неудач
const BLOCK_MS = 15 * 60 * 1000; // длительность блокировки после превышения

interface Entry {
  count: number;
  windowEnd: number;
  blockedUntil: number;
}

const store = new Map<string, Entry>();

// Чистим протухшие записи, когда Map разрастается (чтобы память не текла).
function prune(now: number): void {
  if (store.size < 5000) return;
  for (const [k, e] of store) {
    if (e.blockedUntil < now && e.windowEnd < now) store.delete(k);
  }
}

export function loginRateKey(ip: string, email: string): string {
  return `${ip}|${email.trim().toLowerCase()}`;
}

/** Если заблокировано — сколько секунд ещё ждать; иначе 0. */
export function loginBlockedFor(key: string): number {
  const e = store.get(key);
  if (!e) return 0;
  const now = Date.now();
  return e.blockedUntil > now ? Math.ceil((e.blockedUntil - now) / 1000) : 0;
}

export function recordLoginFailure(key: string): void {
  const now = Date.now();
  prune(now);
  let e = store.get(key);
  if (!e || e.windowEnd < now) {
    e = { count: 0, windowEnd: now + WINDOW_MS, blockedUntil: 0 };
  }
  e.count += 1;
  if (e.count >= MAX_FAILURES) {
    e.blockedUntil = now + BLOCK_MS;
  }
  store.set(key, e);
}

export function recordLoginSuccess(key: string): void {
  store.delete(key);
}
