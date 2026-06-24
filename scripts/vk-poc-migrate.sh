#!/usr/bin/env bash
#
# PoC-перенос КАТАЛОГА (products + product_stocks) Supabase -> VK Cloud для замера
# скорости перед боевой миграцией. Персональные данные (orders/profiles/carts) НЕ
# переносим — их зальём после настройки SSL/шифрования.
#
# Выполнять С VPS (там стабильная связь и образ postgres:17 уже скачан):
#   bash /var/www/brocar/scripts/vk-poc-migrate.sh 'host=212.233.99.36 port=5432 user=user dbname=brocar-db password=ПАРОЛЬ sslmode=disable'
#
# Источник (Supabase) скрипт берёт сам из окружения приложения — пароль Supabase
# нигде не светится.
#
set -uo pipefail
IMG=postgres:17
VK_DSN="${1:-}"
if [ -z "$VK_DSN" ]; then
  echo "Использование: bash $0 '<DSN целевой БД VK>'"
  exit 1
fi

line() { echo "=================================================================="; }

line; echo "1) Ищу строку подключения к Supabase (источник)"
SRC=$(docker exec brocar-app printenv DATABASE_URL 2>/dev/null || true)
for f in /var/www/brocar/.env /var/www/brocar/.env.local; do
  if [ -z "$SRC" ] && [ -f "$f" ]; then
    SRC=$(grep -E '^DATABASE_URL=' "$f" | head -1 | cut -d= -f2- | tr -d '"')
  fi
done
if [ -z "$SRC" ]; then echo "  ОШИБКА: DATABASE_URL не найден ни в контейнере, ни в .env"; exit 1; fi
echo "  ок (источник найден)"

line; echo "2) Проверяю, что источник дампится (pg_dump schema-only по products)"
if ! docker run --rm "$IMG" pg_dump "$SRC" --schema-only -t public.products >/dev/null 2>/tmp/pgd_err; then
  echo "  ОШИБКА pg_dump из Supabase:"; cat /tmp/pgd_err
  echo "  (часто причина — direct-хост Supabase по IPv6 недоступен с VPS; тогда нужен session-pooler на 5432)"
  exit 1
fi
echo "  ок (источник дампится)"

line; echo "3) Поднимаю расширения на VK"
docker run --rm "$IMG" psql "$VK_DSN" -v ON_ERROR_STOP=1 \
  -c 'create extension if not exists pg_trgm' \
  -c 'create extension if not exists pgcrypto' \
  -c 'create extension if not exists "uuid-ossp"'

line; echo "4) Дамп каталога Supabase -> restore VK (products + product_stocks, индексы приедут с дампом)"
docker run --rm "$IMG" pg_dump "$SRC" --no-owner --no-privileges \
  -t public.products -t public.product_stocks -Fc \
  | docker run --rm -i "$IMG" pg_restore --no-owner --no-privileges --clean --if-exists -d "$VK_DSN"

line; echo "5) ANALYZE + сверка количества строк (VK vs Supabase)"
docker run --rm "$IMG" psql "$VK_DSN" -c 'analyze' \
  -c 'select count(*) as products_vk from products' \
  -c 'select count(*) as stocks_vk from product_stocks'
docker run --rm "$IMG" psql "$SRC" -c 'select count(*) as products_src from products'

line; echo "6) ЗАМЕР СКОРОСТИ: тяжёлый DISTINCT (тот, что тормозил 5-12с) — VK против Supabase"
echo "--- VK (Москва, рядом с VPS, свежая таблица без раздутия) ---"
docker run --rm "$IMG" psql "$VK_DSN" -c '\timing on' \
  -c "select count(distinct brand) from products where car_brands @> ARRAY['KIA']::text[] and stock > 0"
echo "--- Supabase (Ирландия, раздутая таблица) ---"
docker run --rm "$IMG" psql "$SRC" -c '\timing on' \
  -c "select count(distinct brand) from products where car_brands @> ARRAY['KIA']::text[] and stock > 0"

line; echo "7) Проверка pg_trgm на VK"
docker run --rm "$IMG" psql "$VK_DSN" \
  -c "select word_similarity('маслo','масло') > 0.3 as trgm_ok"

line; echo "ГОТОВО. Каталог в VK, индексы из дампа, скорость замерена (см. п.6)."
echo "Перс. данные НЕ переносились — это после настройки SSL."
