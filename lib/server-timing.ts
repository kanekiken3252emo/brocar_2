import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Лёгкий «трейсинг» запросов через Server-Timing — без внешних сервисов.
 *
 * Идея: на каждый HTTP-запрос считаем, сколько обращений к БД он сделал и сколько
 * занял целиком, и кладём это в заголовок ответа `Server-Timing`. Видно прямо в
 * DevTools браузера (Network → таб Timing) на любой странице, плюс можно свипом по
 * всем роутам собрать единую картину «где время».
 *
 * Почему счётчик запросов, а не время каждого: postgres.js не даёт длительности
 * на завершении запроса, а оборачивать его клиент (чтобы измерять) — рискованно
 * прямо перед переездом БД. Зато число round-trip'ов к БД × известная латентность
 * (~106мс до Ирландии) даёт хорошую оценку «сколько в total съела БД».
 */
type Store = { queries: number; start: number };
const als = new AsyncLocalStorage<Store>();

/** Вызывается из postgres.js debug-хука — +1 запрос к БД в рамках текущего HTTP-запроса. */
export function trackQuery(): void {
  const s = als.getStore();
  if (s) s.queries++;
}

/**
 * Оборачивает GET/POST роута: запускает его в ALS-контексте (чтобы trackQuery знал,
 * к какому запросу относить запросы к БД) и добавляет в ответ Server-Timing:
 *   total;dur=<мс>            — полное время обработки роута
 *   db-queries;desc="<N>"     — сколько запросов к БД сделано
 *   db-est;dur=<N*106>        — грубая оценка времени в БД (N round-trip'ов к Ирландии)
 */
export function withServerTiming<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>
): (...args: A) => Promise<Response> {
  return (...args: A) => {
    const store: Store = { queries: 0, start: performance.now() };
    return als.run(store, async () => {
      const res = await handler(...args);
      const total = Math.round(performance.now() - store.start);
      try {
        res.headers.set(
          "Server-Timing",
          `total;dur=${total}, db-queries;desc="${store.queries}", db-est;dur=${store.queries * 106}`
        );
      } catch {
        // некоторые ответы (redirect) могут иметь иммутабельные заголовки — не критично
      }
      return res;
    });
  };
}
