# План переключения приложения на VK PostgreSQL (Фаза 1)

> Сгенерировано аудитом кодовой базы (6 агентов). Auth остаётся на Supabase.
> Связано с [DB-MIGRATION.md](DB-MIGRATION.md) (механика дампа) и [HANDOFF.md](HANDOFF.md).

## 1. Переезжает чисто (через drizzle `db`, только смена URL)
Каталог: `products`, `product_stocks`, `suppliers`, `price_rules`, `product_images`.
Торговля: `carts`, `cart_items`, `orders`, `order_items` (фильтр по `userId` в коде, RLS не нужен).
Контент: `news`, `stories`. Чтение `profiles` через drizzle в `api/orders` и `admin/orders`.

## 2. Сломается при простой смене URL (split-brain) — 5 call-sites в 4 файлах
Ходят в Supabase через PostgREST (`supabase.from`), а НЕ через `DATABASE_URL`:

| Файл | Операции | Таблица |
|---|---|---|
| `app/api/profile/route.ts` | read/insert/update | `profiles` |
| `app/dashboard/page.tsx` | read `full_name` | `profiles` |
| `app/api/garage/route.ts` | read/insert | `vehicles` |
| `app/api/garage/[id]/route.ts` | update/delete | `vehicles` |

Плюс блокер подключения: `lib/db/index.ts` включает SSL только для `supabase.com` → к VK (`212.233.99.36`) подключится без TLS, VK с `sslmode=require` отвергнет.

## 3. Переписать `supabase.from` → drizzle `db` (модели уже в schema.ts)
- **profile GET**: `db.query.profiles.findFirst(...)`; если нет — ленивый `db.insert(profiles)` (заменяет триггер `handle_new_user`). PATCH: `db.update(profiles)`. Маппинг snake→camel; **ответ клиенту оставить snake_case** (фронт ждёт `profile.full_name`).
- **dashboard**: `db.query.profiles.findFirst({columns:{fullName:true}})`.
- **garage GET/POST**: `db.select/insert(vehicles)`.
- **garage [id] PATCH/DELETE**: `db.update/delete` — **обязательно `and(eq(vehicles.id,id), eq(vehicles.userId,user.id))`** (RLS на VK мёртв → фильтр по userId единственная защита «только своё»).

## 4. Остаётся на Supabase (auth) — env НЕ трогаем
`middleware.ts`, `lib/auth.ts`, `lib/api-auth.ts`, `lib/supabase/*`, `app/auth/*`, `lib/admin.ts` (права по email из JWT, в БД не ходит). Env `SUPABASE_URL`/ключи указывают на Supabase. `auth.users` — источник истины identity; `profiles.id`/`vehicles.user_id` на VK = голые UUID без FK.

## 5. Правки lib/db/index.ts
SSL завязать на `sslmode=require` (не на IP):
```ts
ssl:
  connectionString.includes("supabase.com") ||
  connectionString.includes("sslmode=require")
    ? "require"
    : undefined,
```
`isPooler` (по `pooler.supabase.com`) на VK сам станет false → `prepare:true`. Env: `DATABASE_URL` → `...@212.233.99.36:5432/brocar-db?sslmode=require`; **`DATABASE_POOLER_URL` удалить** (иначе перебьёт VK, берётся первым).
(Опц.) ~15 `scripts/*.mjs` дублируют ту же SSL-логику — для запуска против VK им нужна та же правка.

## 6. Обработка restore в VK
Расширения ДО restore: `pg_trgm`, `pgcrypto`, `"uuid-ossp"`.
Дамп: `pg_dump --schema=public --no-owner --no-privileges --no-comments -Fc`.
Игнорируем на restore (данные COPY заливаются всё равно, без `ON_ERROR_STOP`):
1. FK на `auth.users` (2 шт: profiles.id, vehicles.user_id) — схемы auth нет.
2. RLS-политики с `auth.uid()` — не тащить; если включились — `DISABLE ROW LEVEL SECURITY`.
3. Триггер `on_auth_user_created` + `handle_new_user()` — заменяется ленивым upsert в profile GET.
После: `npm run db:catalog-idx` + `enable-fuzzy-search.mjs` + `ANALYZE`.

## 7. Порядок + откат
**Подготовка (без влияния на прод):** правки кода (п.3,5) → проверить локально против тестовой VK → задеплоить код заранее (совместим и с Supabase-URL).
**Окно (низкий трафик):** read-only → pg_dump → pg_restore → индексы+ANALYZE → сверка counts → переключить env (`DATABASE_URL`→VK, удалить POOLER) → передеплой → smoke-тест (каталог/поиск/заказ/профиль read+save/гараж/письмо/admin).
**Откат:** вернуть env на Supabase (её данные при дампе не менялись) → сайт мгновенно назад. Код откатывать не нужно (совместим с обеими). Решение об откате — в первые минуты по smoke-тесту.

**Риски:** SSL не включился (→`?sslmode=require` в URL); забыли удалить POOLER (→молча идёт в Supabase); потеряли `userId` в WHERE (→утечка чужих данных); записи в окне дампа теряются (→короткое окно); pg_trgm не поднят (→каталог медленнее).
