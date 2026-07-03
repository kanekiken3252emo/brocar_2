#!/usr/bin/env bash
#
# Диагностика «сайт временами ложится намертво»: собирает форензику за последние
# 48 часов из логов сервера. Запуск на VPS (root):
#   bash /var/www/brocar/scripts/server-diagnose.sh 2>&1 | tee /tmp/brocar-diag.txt
# Результат прислать целиком — по нему видно, ЧТО происходило в минуты инцидентов.
set -uo pipefail

H=48
AL=/var/log/nginx/access.log
EL=/var/log/nginx/error.log

section() { echo; echo "───── $1 ─────"; }

echo "=== BROCAR DIAGNOSE $(date -u '+%F %T UTC') (последние ${H}ч) ==="

section "1. Система сейчас"
free -h; uptime; df -h / | tail -1

section "2. OOM-киллер за ${H}ч (пусто = памяти хватало)"
journalctl -k --since "-${H}h" --no-pager 2>/dev/null \
  | grep -iE "out of memory|oom-kill|killed process" | tail -20 || echo "(пусто)"

section "3. Контейнер: рестарты и события"
docker inspect brocar-app --format 'started={{.State.StartedAt}}  restarts={{.RestartCount}}  oom_killed={{.State.OOMKilled}}' 2>/dev/null
docker events --since "${H}h" --until 1s --filter container=brocar-app 2>/dev/null | tail -15
echo "(события выше: die/start = контейнер падал; пусто = не падал)"

section "4. Ошибки приложения за ${H}ч (сгруппированы)"
docker logs brocar-app --since "${H}h" 2>&1 \
  | grep -ioE "error[^\"]{0,80}|timeout[^\"]{0,60}|ECONNRE[A-Z]+|EAI_AGAIN|CONNECT_TIMEOUT|too many clients|remaining connection slots" \
  | sort | uniq -c | sort -rn | head -25

section "5. nginx: 499/5xx по часам (499 = клиент не дождался ответа — маркер зависания)"
for f in "$AL" "$AL.1"; do [ -f "$f" ] && cat "$f"; done \
  | awk '$9==499 || $9>=500 {print substr($4,2,14), $9}' \
  | sort | uniq -c | tail -40
echo "(формат: количество  дата:час  код)"

section "6. Минуты-инциденты: >=5 плохих ответов за минуту"
for f in "$AL" "$AL.1"; do [ -f "$f" ] && cat "$f"; done \
  | awk '$9==499 || $9>=500 {m=substr($4,2,17); c[m]++} END {for (k in c) if (c[k]>=5) print c[k], k}' \
  | sort -k2 | tail -30

section "7. nginx error.log: проблемы с апстримом (Node не отвечал)"
for f in "$EL" "$EL.1"; do [ -f "$f" ] && cat "$f"; done \
  | grep -iE "upstream|timed out|connection reset|no live" \
  | awk '{print $1, $2}' | cut -c1-16 | sort | uniq -c | tail -30
echo "(формат: количество  дата время — когда nginx не мог достучаться до Node)"

section "8. Нагрузка: запросов в час + топ IP + боты"
for f in "$AL" "$AL.1"; do [ -f "$f" ] && cat "$f"; done \
  | awk '{print substr($4,2,14)}' | sort | uniq -c | tail -30
echo "— топ-10 IP:"
for f in "$AL" "$AL.1"; do [ -f "$f" ] && cat "$f"; done \
  | awk '{print $1}' | sort | uniq -c | sort -rn | head -10
echo "— боты:"
for f in "$AL" "$AL.1"; do [ -f "$f" ] && cat "$f"; done \
  | grep -oiE "yandex[a-z]*bot|googlebot|bingbot|ahrefsbot|semrushbot|mj12bot|petalbot|amazonbot|gptbot" \
  | sort | uniq -ci | sort -rn

section "9. БД из контейнера: пинг + активные/зависшие запросы"
docker exec brocar-app node -e "
const t0 = Date.now();
import('postgres').then(async ({ default: postgres }) => {
  const url = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
  const sql = postgres(url, { max: 1, connect_timeout: 10,
    ssl: url.includes('sslmode=require') || url.includes('supabase.com') ? 'require' : undefined });
  try {
    await sql\`SELECT 1\`;
    console.log('SELECT 1:', Date.now() - t0, 'ms (норма < 50мс; > 500мс = сеть/БД тупит)');
    const act = await sql\`SELECT state, COUNT(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() GROUP BY state\`;
    console.log('соединения по состояниям:', JSON.stringify(act));
    const slow = await sql\`SELECT pid, EXTRACT(EPOCH FROM (now() - query_start))::int AS sec, LEFT(query, 100) AS q FROM pg_stat_activity WHERE state = 'active' AND query_start < now() - interval '5 seconds' ORDER BY query_start LIMIT 5\`;
    console.log('запросы длиннее 5с прямо сейчас:', JSON.stringify(slow));
  } catch (e) { console.log('DB ERROR:', e.message); }
  finally { await sql.end({ timeout: 3 }); }
});" 2>&1

section "10. CPU steal (виртуализация; st > 5% = сосед по хосту душит наш VPS)"
vmstat 1 3 2>/dev/null | tail -2 || echo "(vmstat недоступен)"

section "11. Ежеминутный монитор (если уже установлен)"
[ -f /var/log/brocar-health.log ] && tail -30 /var/log/brocar-health.log || echo "(ещё не установлен — см. scripts/health-monitor.sh)"

echo; echo "=== КОНЕЦ ==="
