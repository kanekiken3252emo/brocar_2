#!/usr/bin/env bash
#
# Ручной деплой Brocar на VPS (замена убранного авто-деплоя «* * * * * brocar-deploy.sh»).
#
# Почему так:
#   1. ОБЯЗАТЕЛЬНЫЙ git-sync. Импорт/прогрев-cron делают `docker cp /var/www/brocar/...`
#      из папки на диске, а не из git. Раньше её держал свежей авто-деплой. Теперь —
#      этот скрипт. Без git reset --hard ночные задачи возьмут устаревший код.
#   2. Сборка ВНЕ блокировки. `npm run build` (output:standalone) спайкает ~1.5-2 ГБ
#      RAM. Гейт по свободной памяти, чтобы сборка не уронила живой контейнер
#      (именно это и давало ERR_CONNECTION_CLOSED).
#   3. Пересоздание контейнера (`up -d`) — секундное, под общим flock, чтобы не
#      пересечься с импортом/прогревом.
#
# Установка на VPS:  install -m 755 /var/www/brocar/scripts/manual-deploy.sh /usr/local/bin/brocar-manual-deploy.sh
# Запуск:            /usr/local/bin/brocar-manual-deploy.sh 2>&1 | tee -a /var/log/brocar-deploy.log

set -euo pipefail

REPO_DIR="${BROCAR_DIR:-/var/www/brocar}"
LOCK="/var/lock/brocar.lock"
MIN_FREE_MB="${BROCAR_MIN_FREE_MB:-1500}"  # минимум свободной RAM для сборки

cd "$REPO_DIR"

# Сборка на 4 ГБ RAM притормаживает живой сайт (swap) — посетители видят
# «висит/Соединение прервано» на 3-6 минут. Поэтому в рабочие часы магазина
# (Пн–Сб, 10:00–19:00 по серверному времени) даём 15 секунд передумать.
# Пропустить проверку: BROCAR_FORCE=1 brocar-manual-deploy.sh
HOUR="$(date +%H)"; DOW="$(date +%u)"
if [ "${BROCAR_FORCE:-0}" != "1" ] && [ "$DOW" -le 6 ] && [ "$HOUR" -ge 10 ] && [ "$HOUR" -lt 19 ]; then
  echo "ВНИМАНИЕ: сейчас рабочие часы магазина — сборка притормозит сайт на 3-6 минут."
  echo "Лучше деплоить до 10:00 или после 19:00. Ctrl-C в течение 15 секунд, чтобы прервать."
  sleep 15
fi

echo "== Свободная память до сборки =="
free -h || true

# Предупредить, если на диске есть несохранённые правки — git reset --hard их сотрёт.
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ВНИМАНИЕ: в $REPO_DIR есть незакоммиченные изменения — git reset --hard их УДАЛИТ:"
  git status --short
  echo "Ctrl-C в течение 10 секунд, чтобы прервать."
  sleep 10
fi

# 1) GIT-SYNC — обязателен. Кормит путь `docker cp /var/www/brocar/{scripts,lib}`
#    у ночных cron. .env / .env*.local в .gitignore, reset --hard их не трогает.
echo "== git fetch && reset --hard origin/main =="
git fetch origin
git reset --hard origin/main

# 2) СБОРКА вне блокировки. Гейт по свободной RAM, чтобы build не зацепил живой
#    контейнер OOM-киллером.
AVAIL_MB="$(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo)"
echo "MemAvailable: ${AVAIL_MB} MB (нужно >= ${MIN_FREE_MB} MB)"
if [ "$AVAIL_MB" -lt "$MIN_FREE_MB" ]; then
  echo "ОТКАЗ: мало свободной RAM — npm run build может уронить живой контейнер."
  echo "Освободи память (или собери образ вне прода и сделай docker compose pull) и повтори."
  exit 1
fi
echo "== docker compose build =="
docker compose build

# 3) ПЕРЕСОЗДАНИЕ контейнера под общим flock (секундная операция, не вся сборка).
echo "== docker compose up -d (под flock $LOCK) =="
flock -w 1200 "$LOCK" docker compose up -d

echo "== Свободная память после =="
free -h || true
docker compose ps

# 4) Пост-деплой проверка: контейнер отвечает на :3000 (nginx-апстрим живой).
echo "== Проверка http://localhost:3000 =="
for i in $(seq 1 15); do
  if curl -fsS http://localhost:3000 >/dev/null 2>&1; then
    echo "OK: приложение отвечает."
    docker image prune -f >/dev/null 2>&1 || true
    exit 0
  fi
  sleep 2
done
echo "ВНИМАНИЕ: приложение не ответило на :3000 за 30с — смотри docker compose logs -f."
exit 1
