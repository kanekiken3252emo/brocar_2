#!/usr/bin/env bash
#
# Точечный до-перенос таблицы suppliers на VK. В полном дампе она падала из-за
# дефолта `extensions.uuid_generate_v4()` (Supabase держит uuid-ossp в схеме
# extensions, которой на VK нет). Обходим: создаём таблицу без extensions-дефолта
# (у существующих строк id уже есть) и переливаем только данные.
#
# Запуск с VPS:
#   bash /var/www/brocar/scripts/vk-fix-suppliers.sh '<VK_DSN с sslmode=require>'
#
set -uo pipefail
IMG=postgres:17
VK_DSN="${1:-}"
[ -z "$VK_DSN" ] && { echo "Использование: bash $0 '<VK_DSN sslmode=require>'"; exit 1; }

POOL=$(docker exec brocar-app printenv DATABASE_POOLER_URL 2>/dev/null || true)
for f in /var/www/brocar/.env /var/www/brocar/.env.local; do
  [ -z "$POOL" ] && [ -f "$f" ] && POOL=$(grep -E '^DATABASE_POOLER_URL=' "$f" | head -1 | cut -d= -f2- | tr -d '"')
done
[ -z "$POOL" ] && { echo "ОШИБКА: DATABASE_POOLER_URL не найден"; exit 1; }
SRC=$(echo "$POOL" | sed -E 's#:6543/#:5432/#'); SRC="${SRC%%\?*}?sslmode=require"

echo "1) Создаю таблицу suppliers на VK (без extensions-дефолта)"
docker run --rm "$IMG" psql "$VK_DSN" -v ON_ERROR_STOP=1 -c \
  'create table if not exists public.suppliers (id uuid primary key, name text not null, api_base_url text, api_key text, created_at timestamptz not null default now())'

echo "2) Переливаю данные suppliers (только строки) Supabase -> VK"
docker run --rm "$IMG" pg_dump "$SRC" --data-only --no-owner -t public.suppliers -Fc \
  | docker run --rm -i "$IMG" pg_restore --data-only --no-owner -d "$VK_DSN"

echo "3) Восстанавливаю FK products.supplier_id -> suppliers.id (если ещё нет)"
docker run --rm "$IMG" psql "$VK_DSN" -c \
  'alter table public.products add constraint products_supplier_id_fkey foreign key (supplier_id) references public.suppliers(id)' \
  2>&1 | sed 's/^/  /' || true

echo "4) Сверка"
s=$(docker run --rm "$IMG" psql "$SRC" -tAc 'select count(*) from suppliers' | tr -d '[:space:]')
v=$(docker run --rm "$IMG" psql "$VK_DSN" -tAc 'select count(*) from suppliers' | tr -d '[:space:]')
echo "  suppliers: Supabase=$s VK=$v"
[ "$s" = "$v" ] && echo "ГОТОВО ✅ suppliers сошлась — теперь в VK все 13 таблиц." || echo "⚠️ всё ещё расхождение"
