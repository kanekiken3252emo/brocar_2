# ⏰ Ежедневные задачи (cron на VPS) — как это устроено

> Это **документация уже работающей схемы** на VPS (`217.114.7.83`, `/var/www/brocar`).
> Сам crontab живёт на сервере (`crontab -l` под root) — здесь он зафиксирован,
> чтобы знание не потерялось, если сервер придётся поднимать заново.
> **Менять ничего не требуется** — схема сама использует свежий код.

## Почему мусор Армтека не вернётся

Ключевой момент: **импорт всегда исполняет последнюю версию кода.**

1. Деплой-cron раз в минуту делает `git reset --hard origin/main` → папка
   `/var/www/brocar` на сервере всегда равна последнему коммиту `main`.
2. Импорт-cron перед запуском копирует свежие `scripts/` и `lib/` в контейнер
   (`docker cp`) и только потом запускает импортёр **внутри** контейнера.

Версионного дрейфа нет. Баг был не в устаревшей копии на каком-то ПК, а в самом
импортёре в репозитории (Армтек сменил формат прайса на 12 колонок — маппинг
колонок не обновили). После фикса в `main` cron берёт исправленный код сам.

## Расписание (crontab -l, root) — время серверное

```cron
# Авто-деплой: каждую минуту. git fetch; если есть новый коммит в origin/main —
# git reset --hard + docker compose up -d --build. Логи: /var/log/brocar-deploy.log
* * * * * flock -n /var/lock/brocar.lock /usr/local/bin/brocar-deploy.sh >> /var/log/brocar-deploy.log 2>&1

# 05:00 — импорт всех поставщиков из почты (Berg, ШАТЕ-М, Форум-Авто, Армтек, Россико)
0 5 * * * flock -w 1200 /var/lock/brocar.lock -c "docker exec -u root brocar-app mkdir -p /app/scripts /app/lib && docker cp /var/www/brocar/scripts/. brocar-app:/app/scripts && docker cp /var/www/brocar/lib/. brocar-app:/app/lib && docker exec -u root brocar-app sh -c '[ -d /app/scripts/node_modules/imapflow ] || (cd /app/scripts && npm init -y >/dev/null 2>&1 && npm i imapflow mailparser adm-zip exceljs postgres --no-audit --no-fund)' && docker exec -u root brocar-app node /app/scripts/import-all-from-email.mjs" >> /var/log/brocar-import.log 2>&1

# 08:30 — отдельный прогон Армтека
30 8 * * * flock -w 1200 /var/lock/brocar.lock -c "docker exec -u root brocar-app mkdir -p /app/scripts /app/lib && docker cp /var/www/brocar/scripts/. brocar-app:/app/scripts && docker cp /var/www/brocar/lib/. brocar-app:/app/lib && docker exec -u root brocar-app sh -c '[ -d /app/scripts/node_modules/imapflow ] || (cd /app/scripts && npm init -y >/dev/null 2>&1 && npm i imapflow mailparser adm-zip exceljs postgres --no-audit --no-fund)' && docker exec -u root brocar-app node /app/scripts/import-armtek-from-email.mjs" >> /var/log/brocar-import.log 2>&1

# 22:00 — прогрев картинок (S3), порция 30000, по localhost
0 22 * * * flock -w 1200 /var/lock/brocar.lock -c "docker exec -u root brocar-app sh -c '[ -d /app/node_modules/postgres ] || { rm -rf /tmp/pg && mkdir -p /tmp/pg && cd /tmp/pg && npm i postgres@3.4.5 --no-save --no-audit --no-fund && cp -r /tmp/pg/node_modules/postgres /app/node_modules/postgres; }' && docker cp /var/www/brocar/scripts/warm-product-images.mjs brocar-app:/app/warm.mjs && docker exec -e WARM_LIMIT=30000 -e WARM_CONCURRENCY=6 -e WARM_BASE_URL=http://127.0.0.1:3000 brocar-app node /app/warm.mjs" >> /var/log/brocar-warm.log 2>&1
```

Все задачи под одним `flock /var/lock/brocar.lock`, чтобы деплой и импорт не
пересекались.

## Полезное

```bash
# Логи
tail -f /var/log/brocar-deploy.log
tail -f /var/log/brocar-import.log
tail -f /var/log/brocar-warm.log

# Ручной прогон импорта (как в cron)
docker cp /var/www/brocar/scripts/. brocar-app:/app/scripts
docker exec -u root brocar-app node /app/scripts/import-armtek-from-email.mjs

# Проверка маппинга колонок Армтека без записи в БД
docker exec -u root brocar-app node /app/scripts/import-armtek-from-email.mjs --dry

# Если поменяли формат и снова поползли цены — посмотреть сырые колонки письма:
docker exec -u root brocar-app node /app/scripts/inspect-armtek-columns.mjs
```

## Предохранители в коде (на случай новой смены формата)

- Импортёр: `isSanePrice` пропускает неправдоподобные цены — мусор в БД не попадёт.
- Роуты каталога: SQL-фильтр битых цен (см. `lib/suppliers/adapter.ts` → `isValidPrice`).
- Карточки + `app/error.tsx`: `null`/`NaN` не роняют страницу.

Если Армтек снова сменит порядок колонок — поправить нужно `parseXlsx` в
`scripts/import-armtek-from-email.mjs` (текущий маппинг: бренд=3, артикул=4,
название=5, кол-во=8, цена=9), свериться через `inspect-armtek-columns.mjs`.
