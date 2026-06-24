#!/usr/bin/env bash
#
# ПОЛНЫЙ перенос схемы public (все таблицы) Supabase -> VK Cloud по SSL.
# Финальный cutover данных. Источник Supabase берётся из env (пароль не светится).
#
# Запуск С VPS:
#   bash /var/www/brocar/scripts/vk-full-migrate.sh 'host=212.233.99.36 port=5432 user=user dbname=brocar-db password=ПАРОЛЬ sslmode=require'
#
set -uo pipefail
IMG=postgres:17
VK_DSN="${1:-}"
if [ -z "$VK_DSN" ]; then echo "Использование: bash $0 '<DSN целевой БД VK, sslmode=require>'"; exit 1; fi

line() { echo "=================================================================="; }

line; echo "1) Источник: session-пулер Supabase (IPv4 :5432)"
POOL=$(docker exec brocar-app printenv DATABASE_POOLER_URL 2>/dev/null || true)
for f in /var/www/brocar/.env /var/www/brocar/.env.local; do
  if [ -z "$POOL" ] && [ -f "$f" ]; then
    POOL=$(grep -E '^DATABASE_POOLER_URL=' "$f" | head -1 | cut -d= -f2- | tr -d '"')
  fi
done
if [ -z "$POOL" ]; then echo "  ОШИБКА: DATABASE_POOLER_URL не найден"; exit 1; fi
SRC=$(echo "$POOL" | sed -E 's#:6543/#:5432/#')
SRC="${SRC%%\?*}?sslmode=require"
echo "  ок ($(echo "$SRC" | sed -E 's#//[^@]+@#//***@#'))"

line; echo "2) Расширения на VK"
docker run --rm "$IMG" psql "$VK_DSN" -v ON_ERROR_STOP=1 \
  -c 'create extension if not exists pg_trgm' \
  -c 'create extension if not exists pgcrypto' \
  -c 'create extension if not exists "uuid-ossp"'

line; echo "3) Дамп ВСЕЙ схемы public Supabase -> restore VK (--clean, ошибки игнорируются)"
echo "    Ожидаемо упадут и будут пропущены: FK на auth.users (profiles/vehicles),"
echo "    RLS-политики с auth.uid(), триггер handle_new_user. Данные (COPY) зальются всё равно."
docker run --rm "$IMG" pg_dump "$SRC" --schema=public --no-owner --no-privileges --no-comments -Fc \
  | docker run --rm -i "$IMG" pg_restore --no-owner --no-privileges --clean --if-exists -d "$VK_DSN"

line; echo "4) ANALYZE ключевых таблиц (свежая статистика планировщика)"
docker run --rm "$IMG" psql "$VK_DSN" \
  -c 'analyze products' -c 'analyze product_stocks' -c 'analyze orders' \
  -c 'analyze order_items' -c 'analyze profiles' -c 'analyze vehicles'

line; echo "5) СВЕРКА количества строк (Supabase -> VK) — должны совпасть"
MISMATCH=0
for t in products product_stocks suppliers price_rules product_images carts cart_items orders order_items profiles vehicles news stories; do
  s=$(docker run --rm "$IMG" psql "$SRC" -tAc "select count(*) from $t" 2>/dev/null | tr -d '[:space:]' || echo ERR)
  v=$(docker run --rm "$IMG" psql "$VK_DSN" -tAc "select count(*) from $t" 2>/dev/null | tr -d '[:space:]' || echo ERR)
  flag=""; if [ "$s" != "$v" ]; then flag="   <<< РАСХОЖДЕНИЕ"; MISMATCH=1; fi
  printf "  %-16s Supabase=%-9s VK=%-9s%s\n" "$t" "$s" "$v" "$flag"
done

line; echo "6) Индексы каталога на VK (приезжают с дампом)"
docker run --rm "$IMG" psql "$VK_DSN" -tAc \
  "select count(*) from pg_indexes where schemaname='public' and tablename='products'" \
  | tr -d '[:space:]' | sed 's/^/  индексов на products: /' ; echo
docker run --rm "$IMG" psql "$VK_DSN" -c \
  "select indexname from pg_indexes where schemaname='public' and tablename='products' order by 1"

line
if [ "$MISMATCH" = "0" ]; then
  echo "ГОТОВО ✅ Количество строк сходится по всем таблицам. Данные в VK."
else
  echo "ВНИМАНИЕ ⚠️ Есть расхождения по строкам (см. выше) — разобраться ДО переключения env."
fi
echo "Дальше: щёлк env (DATABASE_URL -> VK, убрать DATABASE_POOLER_URL) + рестарт + firewall."
