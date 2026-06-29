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
  max: isPooler ? 10 : 5,
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




