#!/usr/bin/env bash
#
# Еженедельная АВТО-уборка сервера brocar — чтобы за диском не следить вручную.
# Главный пожиратель места — неиспользуемые docker-образы и build-кэш (копятся
# от сборок). Скрипт их чистит и подрезает разросшиеся логи.
#
# БЕЗОПАСНО: docker system prune -af НЕ трогает работающий контейнер, его образ и
# используемую сеть; том с данными не затрагивается (без --volumes). База на VK,
# на этом сервере данных нет.
#
# Установка (один раз, на VPS под root):
#   install -m 755 /var/www/brocar/scripts/server-maintenance.sh /usr/local/bin/brocar-maintenance.sh
#   ( crontab -l 2>/dev/null; echo '0 3 * * 0 flock -w 600 /var/lock/brocar.lock /usr/local/bin/brocar-maintenance.sh >> /var/log/brocar-maintenance.log 2>&1' ) | crontab -
#
set -euo pipefail

echo "==== $(date -u) brocar maintenance ===="
echo "-- диск до --"
df -h / | tail -1

# 1) Неиспользуемые образы, build-кэш, остановленные контейнеры, висящие сети.
#    Работающий brocar-app и его образ/сеть остаются.
docker system prune -af || true

# 2) Подрезаем большие текстовые логи (оставляем последние 5000 строк).
for f in \
  /var/log/brocar-import.log \
  /var/log/brocar-warm.log \
  /var/log/brocar-deploy.log \
  /var/log/brocar-maintenance.log; do
  [ -f "$f" ] || continue
  size=$(stat -c%s "$f" 2>/dev/null || echo 0)
  if [ "$size" -gt 52428800 ]; then # > 50 МБ
    tail -n 5000 "$f" >"$f.tmp" && mv "$f.tmp" "$f"
    echo "подрезал $f"
  fi
done

echo "-- диск после --"
df -h / | tail -1
echo "==== готово ===="
