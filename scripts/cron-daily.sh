#!/usr/bin/env bash
#
# Обёртка для ежедневного cron на VPS: импорт каталогов поставщиков из почты
# и/или прогрев картинок. Запускается из crontab — см. CRON.md.
#
# Важно: скрипт лежит в репозитории, а brocar-deploy.sh делает git pull каждую
# минуту, поэтому на VPS всегда исполняется СВЕЖАЯ версия импортёров — это и
# защищает от «версионного дрейфа» (старый маппинг колонок на чужом ПК — как
# было с Армтеком).
#
# Использование:
#   scripts/cron-daily.sh import   # импорт каталогов всех поставщиков
#   scripts/cron-daily.sh warm     # прогрев картинок (S3)
#   scripts/cron-daily.sh all      # import, затем warm (по умолчанию)
#
# Тюнинг прогрева через env: WARM_LIMIT (по умолч. 30000),
# WARM_BASE_URL (по умолч. http://localhost:3000 — сайт на том же VPS).

set -uo pipefail

# Перейти в корень репозитория (скрипт лежит в scripts/).
cd "$(dirname "$0")/.." || { echo "Не удалось перейти в корень репозитория"; exit 1; }

# Env-файл: на VPS обычно .env, локально — .env.local.
ENV_FILE=".env"
[ -f "$ENV_FILE" ] || ENV_FILE=".env.local"
if [ ! -f "$ENV_FILE" ]; then
  echo "Не найден ни .env, ни .env.local в $(pwd)"; exit 1
fi

NODE="$(command -v node || true)"
if [ -z "$NODE" ]; then
  echo "Node не найден в PATH. Установи Node 20+ (см. CRON.md)."; exit 1
fi

MODE="${1:-all}"
ts() { date '+%Y-%m-%d %H:%M:%S'; }

run_import() {
  echo "[$(ts)] ▶ Импорт каталогов поставщиков…"
  "$NODE" --env-file="$ENV_FILE" scripts/import-all-from-email.mjs
  local rc=$?
  echo "[$(ts)] ✓ Импорт завершён (код $rc)"
  return $rc
}

run_warm() {
  local limit="${WARM_LIMIT:-30000}"
  local base="${WARM_BASE_URL:-http://localhost:3000}"
  echo "[$(ts)] ▶ Прогрев картинок (LIMIT=$limit, BASE=$base)…"
  WARM_LIMIT="$limit" WARM_BASE_URL="$base" \
    "$NODE" --env-file="$ENV_FILE" scripts/warm-product-images.mjs
  local rc=$?
  echo "[$(ts)] ✓ Прогрев завершён (код $rc)"
  return $rc
}

case "$MODE" in
  import) run_import ;;
  warm)   run_warm ;;
  all)    run_import; run_warm ;;
  *) echo "Использование: $0 [import|warm|all]"; exit 2 ;;
esac
