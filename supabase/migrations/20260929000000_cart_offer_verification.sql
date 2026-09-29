-- Серверная привязка строки корзины к конкретному офферу и часовой TTL
-- проверки коммерческих условий. Все изменения добавочные и совместимы со
-- старыми строками: NULL означает легаси-позицию, которую сервер сопоставит с
-- текущим лучшим предложением того же артикула и бренда.
--
-- ВАЖНО: применить ДО деплоя нового кода. Новый код читает эти колонки при
-- каждом открытии корзины, поэтому непромигрированная БД даст ошибку /api/cart.

ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS supplier_code text;
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS offer_supplier text;
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS source_offer_id text;
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS available_stock integer;
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS verification_status text;
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS condition_change jsonb;

CREATE INDEX IF NOT EXISTS cart_items_verified_at_idx
  ON cart_items (cart_id, verified_at);
