# Runbook переноса БД (Supabase → РФ managed PostgreSQL)

> Готовая последовательность для переноса каталога/заказов с Supabase на managed
> PostgreSQL в РФ (VK Cloud / Yandex Cloud / Selectel — план одинаковый, отличается
> только строка подключения и CA-сертификат провайдера).
>
> **Выполнять с VPS** (`/var/www/brocar`, 217.114.7.83), а не локально: там стабильная
> связь и с Supabase, и с целевой БД, дамп ~1 ГБ не идёт через домашний интернет.

## Факты о текущей БД (снято `scripts/check-db-info.mjs`)
- PostgreSQL **17.6** (цель тоже PG17 → версии совпадают, перенос чистый).
- Размер ~1.1 ГБ (раздут импортами; дамп переносит только живые данные → на цели ужмётся).
- 13 таблиц в схеме `public`, ~813k товаров.
- Расширения в работе: **pg_trgm**, pgcrypto, uuid-ossp (+ pg_stat_statements).
- ⚠️ `supabase_vault` — расширение Supabase, на цель НЕ переносим (берём только `public`).
- Прямой хост Supabase: `db.fonhvyvmvfmpgaicqsak.supabase.co:5432` (строка — в `.env.local` → `DATABASE_URL`).

## Что НЕ входит в этот перенос
- Схема `auth` (Supabase Auth, `auth.users`) — это **Фаза 2** (self-host GoTrue, см. [HANDOFF.md](HANDOFF.md)).
  ⚠️ Если `public.profiles` имеет FK на `auth.users` — при restore FK упадёт (целевой `auth.users` ещё нет).
  Варианты: переносить вместе с авторизацией, либо временно снять FK (`--disable-triggers` / отдельным шагом).
  Проверить перед переносом: `\d public.profiles` на наличие FK в `auth`.

## Шаги

### 0. Подготовка на VPS
```
# Postgres client 17 (для дампа PG17 нужен pg_dump 17)
apt-get update && apt-get install -y postgresql-client-17
# если репозиторий не содержит 17 — подключить PGDG:
#   https://www.postgresql.org/download/linux/ubuntu/
pg_dump --version   # должно быть 17.x
```

### 1. Дамп схемы public из Supabase (он же бэкап)
```
# DATABASE_URL — прямой (порт 5432, НЕ пулер 6543: pg_dump требует session-соединение)
pg_dump "$SUPABASE_DIRECT_URL" \
  --schema=public --no-owner --no-privileges --no-comments \
  -Fc -f /root/brocar_public.dump
ls -lh /root/brocar_public.dump   # ~ сотни МБ
```
- `--schema=public` — только наше приложение (пропускает auth/storage/vault).
- `--no-owner --no-privileges` — не тащим Supabase-роли.
- `-Fc` — custom-формат (гибкий restore, параллелизм).

### 2. Расширения на целевой БД (ДО restore)
```
psql "$TARGET_URL" -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
psql "$TARGET_URL" -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
psql "$TARGET_URL" -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
```
⚠️ На Supabase расширения живут в схеме `extensions`, на vanilla-PG — в `public`. Если в схеме/индексах
есть явные ссылки `extensions.xxx()` — поправить search_path или пересоздать в нужной схеме.

### 3. Restore в целевую БД
```
pg_restore --no-owner --no-privileges --clean --if-exists \
  -d "$TARGET_URL" /root/brocar_public.dump
```

### 4. Индексы и чистка
```
# Функциональный индекс нечёткого поиска (pg_trgm) — если не приехал с дампом:
node --env-file=.env.local scripts/enable-fuzzy-search.mjs   # с TARGET_URL в env
# Индексы каталога (FK, триграммные, idx_products_norm_article):
npm run db:catalog-idx
# ANALYZE для свежей статистики планировщика:
psql "$TARGET_URL" -c "ANALYZE;"
```

### 5. Переключение приложения
- `.env` на VPS: `DATABASE_URL` / `DATABASE_POOLER_URL` → строка целевой БД.
- ⚠️ Правка `lib/db/index.ts`: сейчас SSL включается по `includes("supabase.com")`, а `isPooler`
  по `pooler.supabase.com`. Для VK/Yandex:
  - `ssl` — провайдер требует TLS со своим CA (скачать CA-сертификат, указать в опциях postgres.js:
    `ssl: { ca: fs.readFileSync('...'), rejectUnauthorized: true }`).
  - `isPooler` — у нас своего пулера нет → `prepare: true` (prepared statements можно включить).
  - Прогрев пула оставить.
- Передеплой (cron подхватит сам после push, либо `docker compose up -d --build`).

### 6. Проверка (обязательно до боевого переключения)
```
# Совпадение количества строк:
psql "$SUPABASE_DIRECT_URL" -c "select count(*) from products;"
psql "$TARGET_URL"          -c "select count(*) from products;"
# pg_trgm работает (нечёткий поиск):
psql "$TARGET_URL" -c "select word_similarity('маслo','масло') > 0.4;"
```
- Открыть сайт (на staging-конфиге с TARGET_URL), прогнать: каталог, поиск (в т.ч. с опечаткой),
  карточка товара, заказ.
- Прогнать свип Server-Timing (`curl -D - .../api/catalog/car-brand/kia`) → сравнить латентность
  «было (Ирландия ~106мс/запрос) / стало».

### 7. Откат
- Старая Supabase-БД остаётся нетронутой (мы только читали дампом). Откат = вернуть прежние
  `DATABASE_URL`/`POOLER_URL` + передеплой. Поэтому переключение безопасно.

## Финальный боевой перенос
Дамп выше — для теста/PoC. Перед окончательным переключением снять **свежий** дамп (за время теста
прошли ночные импорты и новые заказы), повторить шаги 1→6 и только потом шаг 5 (переключение env).
Лучшее окно — после ночного импорта и до утреннего трафика.
