import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { trackQuery } from "@/lib/server-timing";

// Приоритет: DATABASE_POOLER_URL (если задан) → DATABASE_URL.
// Сейчас БД на VK Cloud — direct-подключение по 5432.
const connectionString =
  process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL!;

const isPooler = connectionString.includes("pooler.supabase.com");

export const client = postgres(connectionString, {
  // Transaction pooler не поддерживает prepared statements — отключаем.
  prepare: !isPooler,
  // SSL обязателен и для Supabase, и для VK. Раньше включался только по подстроке
  // "supabase.com" — у VK-хоста её нет. Поэтому завязываемся ещё и на sslmode=require
  // в строке подключения (для VK он там обязателен → DATABASE_URL=...?sslmode=require).
  ssl:
    connectionString.includes("supabase.com") ||
    connectionString.includes("sslmode=require")
      ? "require"
      : undefined,
  // 10 соединений (было 5): пул — ГЛОБАЛЬНОЕ бутылочное горлышко. Роут марки
  // делает 3 параллельных запроса → два одновременных захода бота исчерпывали
  // пул из 5, и ВСЕ остальные страницы вставали в очередь (сайт «висит
  // намертво» у всех). Сервер апгрейжен до 12 ГБ — запас есть.
  max: 10,
  // Таймаут на ВЫПОЛНЕНИЕ запроса (серверный, Postgres statement_timeout).
  // Без него один зависший/медленный запрос держит соединение вечно; пять
  // таких — и пул мёртв до «очухивания». 15с: любой честный запрос сайта
  // укладывается с запасом (самый тяжёлый DISTINCT ~7с холодным и кэшируется).
  // Импортов не касается — у скриптов импорта свои подключения.
  // Для pooler'а Supabase startup-параметры не шлём (transaction pooling).
  ...(isPooler ? {} : { connection: { statement_timeout: 15000 } }),
  // НЕ закрываем соединения по простою (раньше было idle_timeout: 20с).
  // Замер показал: установка соединения с пулером Supabase стоит ~1с (несколько
  // round-trip'ов по высокой латентности до региона БД), а сами запросы — <1мс.
  // Закрывать соединение через 20с простоя = платить эту секунду на каждый
  // «первый» заход в каталог. Держим пул тёплым (см. keepalive ниже).
  // max_lifetime изредка пересоздаёт соединение, чтобы не копились «протухшие».
  max_lifetime: 60 * 30,
  connect_timeout: 15,
  // Счётчик запросов к БД на каждый HTTP-запрос (Server-Timing). Хук вызывается
  // на отправку запроса и только увеличивает счётчик в текущем request-контексте —
  // самих запросов/данных не трогает.
  debug: () => trackQuery(),
});

export const db = drizzle(client, { schema });

// Прогрев пула в проде: заранее открываем несколько соединений и держим их
// тёплыми лёгким keepalive-пингом. Иначе первый заход в каталог после паузы
// платит ~1с на холодную установку соединений (узкое место — сеть до Supabase,
// не сами запросы). В dev не нужно — там один разработчик и HMR.
if (process.env.NODE_ENV === "production") {
  const WARM = isPooler ? 6 : 3;
  const warm = () => {
    for (let i = 0; i < WARM; i++) {
      // Параллельные пинги → postgres держит несколько соединений открытыми.
      client`SELECT 1`.catch(() => {});
    }
  };
  warm();
  const timer = setInterval(warm, 4 * 60 * 1000);
  timer.unref?.();
}




