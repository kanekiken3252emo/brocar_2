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
