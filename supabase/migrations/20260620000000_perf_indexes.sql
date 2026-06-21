-- Индексы производительности: FK без авто-индекса + сортировка заказов + триграммный поиск.
-- Дубль того, что делает scripts/add-catalog-indexes.mjs (CONCURRENTLY) — чтобы
-- прод/локальная БД не зависели от ручного запуска скрипта. В миграции CONCURRENTLY
-- нельзя (выполняется в транзакции), поэтому обычный CREATE INDEX: order_items/
-- cart_items/orders небольшие, products пишется только ночным импортом — короткая
-- блокировка на деплое допустима.

-- ── Внешние ключи без авто-индекса ──────────────────────────────────────────
-- Postgres НЕ индексирует FK автоматически. Эти колонки выбираются по одному
-- заказу/корзине, но таблицы растут со всем магазином → без индекса seq scan на
-- каждый просмотр заказа (/order/[id], /garage, /admin/orders, /dashboard) и любое
-- действие с корзиной (открытие, +/-, бейдж в хедере).
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items (cart_id);

-- Лист заказов (админка/дашборд): ORDER BY created_at DESC.
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);

-- ── Триграммный поиск (pg_trgm) ─────────────────────────────────────────────
-- text-search Tier1/2 используют LIKE '%слово%' (ведущий wildcard) — нужен GIN trgm.
-- Выражение ОБЯЗАНО совпадать символ-в-символ с NAME_NORM в text-search route и
-- FOLD_FROM/FOLD_TO (lib/catalog/fold.mjs), иначе индекс не применится.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products
  USING gin (translate(lower(name), 'ёabcehkmoptxy', 'еавсенкмортху') gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_article_trgm ON products
  USING gin (lower(article) gin_trgm_ops);
