/**
 * Заголовки Cache-Control для публичных GET-роутов каталога. Данные обновляются
 * раз в сутки (ночной cron-импорт), персонализации у ответов нет — кэшировать
 * безопасно и агрессивно.
 *
 *   max-age   — кэш в БРАУЗЕРЕ: помогает при back/forward и повторном заходе в
 *               ту же категорию/фильтр без сетевого запроса.
 *   s-maxage  — кэш в ОБЩЕМ кэше (nginx proxy_cache / CDN). Заработает после
 *               включения micro-caching в nginx (см. PERFORMANCE.md).
 *   stale-while-revalidate — отдать устаревший ответ мгновенно и обновить в фоне
 *               (убирает «хвост» холодного старта для повторных заходов).
 */
export const CACHE_MENU =
  "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800";

export const CACHE_LISTING =
  "public, max-age=60, s-maxage=600, stale-while-revalidate=86400";

/**
 * Карточка товара: офферы/цены/остатки опрашиваются у поставщиков вживую.
 * Кэшировать ответ нельзя даже на короткое время: nginx с background update
 * вправе отдавать stale-версию дольше TTL, из-за чего покупатель видит уже
 * исчезнувший склад или старую цену. X-Accel-Expires в роуте дополнительно
 * запрещает сохранение ответа в nginx proxy_cache.
 */
export const CACHE_PRODUCT = "private, no-store, max-age=0";

/**
 * GoodVin: дерево узлов каталога (groups) и детали узла (parts) для фиксированного
 * catalogId/carId/groupId неизменны между пользователями — это статичная структура
 * каталога производителя. Кэшируем агрессивно: повторные клики любого юзера по тем
 * же узлам обслуживаются из nginx/CDN/браузера без round-trip Екб→GoodVin.
 */
export const CACHE_VIN_TREE =
  "public, max-age=600, s-maxage=86400, stale-while-revalidate=604800";

/**
 * GoodVin: распознавание авто по VIN/Frame (car-info). Детерминировано по VIN, но
 * TTL чуть короче дерева — справочник авто обновляется чаще структуры каталога.
 */
export const CACHE_VIN_INFO =
  "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";
