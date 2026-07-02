# ⏰ Ежедневные задачи (cron на VPS) — как это устроено

> Это **документация уже работающей схемы** на VPS (`217.114.7.83`, `/var/www/brocar`).
> Сам crontab живёт на сервере (`crontab -l` под root) — здесь он зафиксирован,
> чтобы знание не потерялось, если сервер придётся поднимать заново.
> **Деплой теперь РУЧНОЙ** (авто-сборка раз в минуту убрана — она спайком памяти
> от `npm run build` на проде роняла контейнер, см. раздел «Ручной деплой» ниже).

## Почему мусор Армтека не вернётся (и что изменилось без авто-деплоя)

Ключевой момент: **импорт исполняет ту версию кода, что лежит в `/var/www/brocar`.**

1. Импорт/прогрев-cron перед запуском копируют `scripts/` и `lib/` в контейнер
   (`docker cp /var/www/brocar/...`) и только потом запускают скрипт **внутри**
   контейнера. То есть берут код **с диска `/var/www/brocar`**, а не из git.
2. Раньше этот диск держал свежим авто-деплой (`git reset --hard origin/main` раз
   в минуту). **Авто-деплой убран** → теперь диск обновляется ТОЛЬКО ручным
   деплоем.

⚠️ **Поэтому ручной деплой ОБЯЗАН делать `git fetch && git reset --hard origin/main`**
(он встроен в `scripts/manual-deploy.sh`). Если задеплоить картинку без git-sync —
папка `/var/www/brocar` застынет, и ночные cron начнут `docker cp` **устаревших**
скриптов: ровно тот «версионный дрейф», от которого мы и защищались.

Баг Армтека был не в устаревшей копии, а в самом импортёре (Армтек сменил формат
прайса на 12 колонок). Фикс в `main` доезжает до cron только после ручного деплоя.

## Расписание (crontab -l, root) — время серверное

```cron
# АВТО-ДЕПЛОЙ УБРАН. Раньше тут была строка «* * * * * ... brocar-deploy.sh»,
# которая раз в минуту делала docker compose up -d --build. Сборка Next (npm run
# build, ~1.5-2 ГБ RAM) на проде при ~15 коммитах/день давала спайки памяти и
# пересоздания контейнера → ERR_CONNECTION_CLOSED. Деплой теперь только руками:
# см. раздел «Ручной деплой» (scripts/manual-deploy.sh).

# 05:00 — импорт всех поставщиков из почты (Berg, ШАТЕ-М, Форум-Авто, Армтек, Россико)
0 5 * * * flock -w 1200 /var/lock/brocar.lock -c "docker exec -u root brocar-app mkdir -p /app/scripts /app/lib && docker cp /var/www/brocar/scripts/. brocar-app:/app/scripts && docker cp /var/www/brocar/lib/. brocar-app:/app/lib && docker exec -u root brocar-app sh -c '[ -d /app/scripts/node_modules/imapflow ] || (cd /app/scripts && npm init -y >/dev/null 2>&1 && npm i imapflow mailparser adm-zip exceljs postgres --no-audit --no-fund)' && docker exec -u root brocar-app node /app/scripts/import-all-from-email.mjs" >> /var/log/brocar-import.log 2>&1

# 08:30 — отдельный прогон Армтека
30 8 * * * flock -w 1200 /var/lock/brocar.lock -c "docker exec -u root brocar-app mkdir -p /app/scripts /app/lib && docker cp /var/www/brocar/scripts/. brocar-app:/app/scripts && docker cp /var/www/brocar/lib/. brocar-app:/app/lib && docker exec -u root brocar-app sh -c '[ -d /app/scripts/node_modules/imapflow ] || (cd /app/scripts && npm init -y >/dev/null 2>&1 && npm i imapflow mailparser adm-zip exceljs postgres --no-audit --no-fund)' && docker exec -u root brocar-app node /app/scripts/import-armtek-from-email.mjs" >> /var/log/brocar-import.log 2>&1

# 22:00 — прогрев картинок (S3). concurrency=3 и limit=15000 были срезаны вдвое
# под старый сервер (4 ГБ RAM): прогрев дёргает /api/product-image внутри
# brocar-app, а там sharp — WARM_CONCURRENCY = число одновременных sharp-операций
# в боевом контейнере. Доп. защита — sharp.concurrency(1) в lib/product-images.ts.
# ПОСЛЕ АПГРЕЙДА СЕРВЕРА (12 ГБ / 6 ядер, июль 2026) можно вернуть полную
# мощность — WARM_LIMIT=30000, WARM_CONCURRENCY=6 — одной командой:
#   crontab -l | sed 's/WARM_LIMIT=15000/WARM_LIMIT=30000/; s/WARM_CONCURRENCY=3/WARM_CONCURRENCY=6/' | crontab -
#   crontab -l | grep WARM   # проверить, что подставилось
0 22 * * * flock -w 1200 /var/lock/brocar.lock -c "docker exec -u root brocar-app sh -c '[ -d /app/node_modules/postgres ] || { rm -rf /tmp/pg && mkdir -p /tmp/pg && cd /tmp/pg && npm i postgres@3.4.5 --no-save --no-audit --no-fund && cp -r /tmp/pg/node_modules/postgres /app/node_modules/postgres; }' && docker cp /var/www/brocar/scripts/warm-product-images.mjs brocar-app:/app/warm.mjs && docker exec -e WARM_LIMIT=15000 -e WARM_CONCURRENCY=3 -e WARM_BASE_URL=http://127.0.0.1:3000 brocar-app node /app/warm.mjs" >> /var/log/brocar-warm.log 2>&1
```

Все задачи под одним `flock /var/lock/brocar.lock`, чтобы деплой и импорт не
пересекались.

## Ручной деплой (вместо убранного авто-деплоя)

Деплой теперь руками. Один раз положи на VPS гард-скрипты из репозитория:

```bash
# Скопировать из репо в /usr/local/bin и сделать исполняемыми
install -m 755 /var/www/brocar/scripts/manual-deploy.sh        /usr/local/bin/brocar-manual-deploy.sh
install -m 755 /var/www/brocar/scripts/disable-autodeploy-cron.sh /usr/local/bin/brocar-disable-autodeploy.sh
```

**Шаг 1 — убрать строку авто-деплоя из crontab (один раз):**

```bash
# Сначала ПОСМОТРИ, что именно удалится (должна найтись ровно 1 строка):
crontab -l | grep -n 'brocar-deploy.sh'
# Гард-скрипт: делает бэкап crontab, удаляет только строку brocar-deploy.sh,
# отказывается работать если совпадений не ровно одно (не затрёт import/warm):
/usr/local/bin/brocar-disable-autodeploy.sh
crontab -l        # проверь: строки 0 5 / 30 8 / 0 22 на месте, «* * * * *» нет
```

**Шаг 2 — выкатывать релиз так (каждый раз, когда хочешь обновить прод):**

```bash
/usr/local/bin/brocar-manual-deploy.sh 2>&1 | tee -a /var/log/brocar-deploy.log
```

Скрипт `manual-deploy.sh`: обязательно делает `git fetch && git reset --hard
origin/main` (иначе ночные cron возьмут устаревшие скрипты — см. выше),
проверяет свободную RAM перед сборкой (чтобы `npm run build` не уронил живой
контейнер), собирает образ **вне** блокировки, и только секундный `up -d`
(пересоздание контейнера) — под `flock`, чтобы не пересечься с импортом/прогревом.

> Если поменял ТОЛЬКО `scripts/` или `lib/` (а не код сайта) — пересборка образа
> не нужна, достаточно git-sync: `cd /var/www/brocar && git fetch origin && git
> reset --hard origin/main`. Ночной cron сам `docker cp` свежие скрипты в контейнер.

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

## Авто-обслуживание (чтобы сервер жил без присмотра)

Чтобы диск не забивался docker-образами/логами и проект работал автономно после
передачи:

- **Логи контейнера** ограничены ротацией в `docker-compose.yml`
  (`logging: max-size 10m × max-file 3`). Применяется при пересоздании контейнера (деплой).
- **Контейнер сам поднимается** после краша/перезагрузки (`restart: always`).
- **SSL** продлевается автоматически (certbot). Проверка: `systemctl status certbot.timer`,
  `certbot renew --dry-run`.
- **Еженедельная авто-уборка** — `scripts/server-maintenance.sh`: чистит
  неиспользуемые docker-образы/build-кэш (`docker system prune -af`; работающий
  контейнер/образ/сеть и тома не трогает) и подрезает большие логи. Установка
  (один раз, root):

  ```bash
  install -m 755 /var/www/brocar/scripts/server-maintenance.sh /usr/local/bin/brocar-maintenance.sh
  ( crontab -l 2>/dev/null; echo '0 3 * * 0 flock -w 600 /var/lock/brocar.lock /usr/local/bin/brocar-maintenance.sh >> /var/log/brocar-maintenance.log 2>&1' ) | crontab -
  ```

После этого присматривать за сервером вручную не требуется.
