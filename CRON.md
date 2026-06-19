# ⏰ Ежедневные задачи (импорт каталогов + прогрев картинок)

Две ежедневные задачи:

1. **Импорт каталогов** — `scripts/import-all-from-email.mjs` забирает прайсы всех
   поставщиков из почты (Berg, ШАТЕ-М, Форум-Авто, Армтек, Россико) и пишет в БД.
2. **Прогрев картинок** — `scripts/warm-product-images.mjs` подтягивает фото у
   поставщиков, кладёт в S3 и кэширует URL, чтобы на сайте они грузились мгновенно.

Обе оборачивает `scripts/cron-daily.sh`.

> ⚠️ **Почему именно на VPS, а не на ПК.**
> Импорт-скрипты нельзя запускать внутри задеплоенного контейнера (Docker собирает
> `output: standalone` — там нет папки `scripts/` и тяжёлых зависимостей вроде
> `exceljs`/`imapflow`). Поэтому раньше они гонялись с ПК. Но у каждого ПК своя
> копия кода — и если на нём **старый импортёр**, он заносит мусор (так и случился
> баг с ценами Армтека: старый маппинг колонок). На VPS `brocar-deploy.sh` делает
> `git pull` каждую минуту, поэтому `scripts/*` там **всегда последней версии** —
> версионного дрейфа нет.

---

## ‼️ Шаг 0. Выключить старую автоматизацию на ПК

Если на ПК уже настроен автозапуск этих задач (Планировщик заданий Windows / cron),
**отключи его перед включением VPS-крона.** Иначе ПК (возможно, со старым кодом)
продолжит ежедневно импортировать параллельно и может снова занести мусор.

- Windows: «Планировщик заданий» → найди задачу импорта/прогрева → **Отключить**.
- Убедись, что задача больше не запускается (история выполнения).

---

## Шаг 1. Установить Node 20 на VPS (один раз)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v        # должно быть v20.x (нужен ≥ 20.6 для --env-file)
```

## Шаг 2. Поставить зависимости в репозитории (один раз; повторять при смене package.json)

```bash
cd /var/www/brocar
npm ci --legacy-peer-deps       # node_modules на хосте, отдельно от Docker-образа
chmod +x scripts/cron-daily.sh
```

## Шаг 3. Дополнить `.env` ключами для импорта и прогрева

Docker-овский `.env` обычно содержит только переменные сайта. Импорту нужны ещё
почтовые и (для картинок) S3-ключи. Скопируй недостающее из `.env.local` с ПК:

```
# Почта (откуда забираем прайсы)
IMAP_HOST=imap.beget.com
IMAP_PORT=993
IMAP_USER=info@brocarparts.ru
IMAP_PASSWORD=...
ARMTEK_SENDER=armtek
# БД
DATABASE_URL=postgresql://...           # или DATABASE_POOLER_URL
# Хранилище картинок (S3 / VK Cloud)
S3_ENDPOINT=...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=...
S3_PUBLIC_BASE=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Шаг 4. Проверить вручную, что всё работает

```bash
cd /var/www/brocar
# Сухой прогон импортёра Армтека (в БД не пишет) — цены должны быть адекватными:
node --env-file=.env scripts/import-armtek-from-email.mjs --dry
# Боевой импорт всех поставщиков:
./scripts/cron-daily.sh import
# Прогрев небольшой порцией для проверки:
WARM_LIMIT=200 ./scripts/cron-daily.sh warm
```

## Шаг 5. Поставить в crontab

```bash
crontab -e
```

```cron
# Импорт каталогов — каждый день в 12:00 (после прихода писем от поставщиков).
# flock не даёт запуститься второму экземпляру, если прошлый ещё идёт.
0 12 * * * flock -n /tmp/brocar-import.lock /var/www/brocar/scripts/cron-daily.sh import >> /var/log/brocar-import.log 2>&1

# Прогрев картинок — каждую ночь в 02:00 (долгий, ~часы; гоняем по localhost).
0 2 * * * flock -n /tmp/brocar-warm.lock /var/www/brocar/scripts/cron-daily.sh warm >> /var/log/brocar-warm.log 2>&1
```

> Время — по часовому поясу сервера (`timedatectl`). Подбери под момент, когда письма
> уже пришли. Прогрев ставь на ночь — он берёт порцию `WARM_LIMIT` (по умолчанию
> 30000) и за несколько ночей закрывает все товары без фото; в установившемся
> режиме новых мало.

## Логи

```bash
tail -f /var/log/brocar-import.log
tail -f /var/log/brocar-warm.log
```

---

## Заметки

- `scripts/cron-daily.sh` сам выбирает `.env` (на VPS) или `.env.local` (локально).
- После каждого `git pull` (авто-деплой) скрипты обновляются сами. Если менялся
  `package.json` — пересними зависимости: `cd /var/www/brocar && npm ci --legacy-peer-deps`.
- Прогрев бьёт по `http://localhost:3000/api/product-image` — это сайт на том же
  VPS, без публичного round-trip. Если контейнер слушает другой порт — поправь
  `WARM_BASE_URL`.
- Мёртвый Vercel-cron `/api/cron/sync` (демо Vendor A/B) к этому не относится и не
  используется на VPS — его можно удалить отдельно.
