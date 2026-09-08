/**
 * Детектор автоматических клиентов по User-Agent. Без зависимостей — работает
 * и в Edge (middleware), и на сервере (страницы).
 *
 * Зачем: каждый НОВЫЙ VIN / артикул — живой платный запрос к Laximo. Кэш
 * закрывает только повторы, а боты ходят по тысячам разных страниц по одному
 * разу. Честные краулеры (поисковики, SEO-сканеры, превью мессенджеров, curl)
 * до платного вызова доходить не должны.
 *
 * Осознанно НЕ ловим:
 *   • «yandex» целиком — YandexSearch/… это браузер живых людей в приложении
 *     Яндекса; ловим только роботов Яндекса по точным именам;
 *   • голое «bot» без границы слова — Cubot это марка телефонов.
 * От парсера, который прикидывается Chrome, это не защищает — для него есть
 * гостевой дневной лимит (см. lib/laximo/guest-limit.ts).
 */
const BOT_RE = new RegExp(
  [
    // Поисковики
    "googlebot",
    "googleother",
    "google-inspectiontool",
    "adsbot-google",
    "mediapartners-google",
    "apis-google",
    "feedfetcher-google",
    "bingbot",
    "bingpreview",
    "msnbot",
    "yandex(bot|images|video|media|blogs|direct|metrika|market|news|webmaster|turbo|screenshot|accessibility|renderresources|mobile|pagechecker|calendar|sitelinks|spravbot|tracker|vertis|ontodb)",
    "baiduspider",
    "duckduckbot",
    "duckduckgo",
    "applebot",
    "mail\\.ru_bot",
    "sputnikbot",
    "petalbot",
    "seznambot",
    "qwantify",
    // SEO / аналитика
    "ahrefs",
    "semrush",
    "mj12bot",
    "dotbot",
    "rogerbot",
    "screaming frog",
    "serpstat",
    "megaindex",
    "linkpadbot",
    "dataforseo",
    "blexbot",
    "seokicks",
    "sitebulb",
    "netpeak",
    // AI-краулеры
    "gptbot",
    "chatgpt-user",
    "oai-searchbot",
    "claudebot",
    "claude-web",
    "anthropic-ai",
    "ccbot",
    "bytespider",
    "amazonbot",
    "perplexitybot",
    "cohere-ai",
    "diffbot",
    "meta-externalagent",
    // Превью ссылок в соцсетях/мессенджерах
    "facebookexternalhit",
    "facebookcatalog",
    "twitterbot",
    "linkedinbot",
    "telegrambot",
    "whatsapp",
    "vkshare",
    "skypeuripreview",
    "discordbot",
    "slackbot",
    "pinterestbot",
    // HTTP-библиотеки и headless
    "curl/",
    "wget/",
    "python-requests",
    "python-urllib",
    "aiohttp",
    "httpx/",
    "scrapy",
    "go-http-client",
    "okhttp",
    "java/",
    "apache-httpclient",
    "libwww-perl",
    "node-fetch",
    "undici",
    "axios/",
    "headlesschrome",
    "phantomjs",
    "puppeteer",
    "playwright",
    "selenium",
    "lighthouse",
    "chrome-lighthouse",
    "pagespeed",
    "gtmetrix",
    "pingdom",
    "uptimerobot",
    "site24x7",
    // Общие маркеры. «bot» — только с границей слова (Cubot — телефон);
    // crawler/spider/scraper в UA живых браузеров не встречаются.
    "crawl",
    "spider",
    "scraper",
    "fetcher",
    "(^|[^a-z])bot([^a-z]|$)",
  ].join("|"),
  "i"
);

/** true — запрос от робота/скрипта (или UA пустой), платные вызовы не делаем. */
export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return true; // браузеры UA не прячут; пустой UA — скрипт
  return BOT_RE.test(ua);
}
