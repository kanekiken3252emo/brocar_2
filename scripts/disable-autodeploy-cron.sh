#!/usr/bin/env bash
#
# Убирает строку авто-деплоя «* * * * * ... brocar-deploy.sh» из root-crontab,
# НЕ трогая остальные задачи (05:00 import, 08:30 armtek, 22:00 warm).
#
# Защита от затирания crontab:
#   - делает бэкап;
#   - отказывается работать, если crontab пуст (иначе `grep -v | crontab -`
#     установил бы пустой crontab и снёс импорт/прогрев);
#   - отказывается, если строк с brocar-deploy.sh не ровно одна.
#
# Установка:  install -m 755 /var/www/brocar/scripts/disable-autodeploy-cron.sh /usr/local/bin/brocar-disable-autodeploy.sh
# Запуск (root):  /usr/local/bin/brocar-disable-autodeploy.sh

set -euo pipefail

TOKEN="brocar-deploy.sh"

CUR="$(crontab -l 2>/dev/null || true)"

if [ -z "$CUR" ]; then
  echo "ОТКАЗ: crontab пуст или недоступен — ничего не меняю (иначе снесу import/warm)."
  exit 1
fi

N="$(printf '%s\n' "$CUR" | grep -c "$TOKEN" || true)"
if [ "$N" -ne 1 ]; then
  echo "ОТКАЗ: ожидал ровно 1 строку с '$TOKEN', нашёл $N. Разберись вручную: crontab -e"
  exit 1
fi

BACKUP="/root/crontab.backup.$(date +%F-%H%M)"
printf '%s\n' "$CUR" > "$BACKUP"
echo "Бэкап crontab: $BACKUP"

printf '%s\n' "$CUR" | grep -v "$TOKEN" | crontab -

echo "Готово. Строка авто-деплоя удалена. Текущий crontab:"
crontab -l
echo "---"
echo "Совпадений '$TOKEN' осталось: $(crontab -l | grep -c "$TOKEN" || true) (должно быть 0)."
echo "Опционально переименуй сам скрипт, чтобы случайно не запустить:"
echo "  mv /usr/local/bin/brocar-deploy.sh /usr/local/bin/brocar-deploy.sh.manual-only 2>/dev/null || true"
