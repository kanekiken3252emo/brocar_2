#!/usr/bin/env bash
#
# Ежеминутный монитор здоровья (для cron). Пишет одну строку в
# /var/log/brocar-health.log: время UTC, load, свободная память, CPU steal,
# статус контейнера, ответ приложения (с проверкой БД: /api/health?deep=1)
# и ответ сайта через nginx/https.
#
# Установка (root, один раз):
#   install -m 755 /var/www/brocar/scripts/health-monitor.sh /usr/local/bin/brocar-health-monitor.sh
#   ( crontab -l; echo '* * * * * /usr/local/bin/brocar-health-monitor.sh' ) | crontab -
#
# Чтение при инциденте («сайт висел в HH:MM»):
#   grep "2026-07-03 14:4" /var/log/brocar-health.log
# Плохие строки сразу видно: local=[503 …] — жив, но БД/пул мёртв;
# local=[000 …] — Node не отвечает; https=[000|5xx] — умер nginx/сеть;
# steal>5% — душит сосед по хосту виртуализации.
set -u

LOG=/var/log/brocar-health.log
TS=$(date -u '+%F %T')
LOAD=$(cut -d' ' -f1-3 /proc/loadavg)
AVAIL=$(awk '/MemAvailable/{printf "%.1fG", $2/1048576}' /proc/meminfo)

# CPU steal за ~1 секунду (столбец 9 в /proc/stat)
read -r _ u1 n1 s1 i1 w1 irq1 sirq1 st1 _ < /proc/stat
sleep 1
read -r _ u2 n2 s2 i2 w2 irq2 sirq2 st2 _ < /proc/stat
T1=$((u1+n1+s1+i1+w1+irq1+sirq1+st1)); T2=$((u2+n2+s2+i2+w2+irq2+sirq2+st2))
STEAL=0; [ $((T2-T1)) -gt 0 ] && STEAL=$(( 100*(st2-st1)/(T2-T1) ))

APP=$(docker inspect -f '{{.State.Status}}' brocar-app 2>/dev/null || echo "нет")
LOCAL=$(curl -s -o /dev/null -m 10 -w "%{http_code} %{time_total}s" "http://127.0.0.1:3000/api/health?deep=1" 2>/dev/null || echo "000 err")
HTTPS=$(curl -s -o /dev/null -m 10 -w "%{http_code} %{time_total}s" "https://brocarparts.ru/" 2>/dev/null || echo "000 err")

echo "$TS load=[$LOAD] avail=$AVAIL steal=${STEAL}% app=$APP local=[$LOCAL] https=[$HTTPS]" >> "$LOG"

# Ротация: держим ~2 недели (по строке в минуту ≈ 20к строк, ~2.5 МБ)
LINES=$(wc -l < "$LOG" 2>/dev/null || echo 0)
if [ "$LINES" -gt 25000 ]; then
  tail -20000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi
