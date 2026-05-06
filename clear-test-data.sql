-- 🧹 Очистка тестовых данных из базы BroCar
-- Запустите этот скрипт в Supabase SQL Editor
-- https://supabase.com/dashboard/project/ngfooubrlgdhaqihihci/editor

-- ⚠️ ВНИМАНИЕ: Этот скрипт удалит все тестовые данные!
-- Структура таблиц и правила ценообразования сохранятся

DO $$
BEGIN
  RAISE NOTICE '🧹 Начинаем очистку тестовых данных...';
END $$;

-- 1. Удалить все items из корзин (cart_items)
-- Это нужно сделать первым из-за внешних ключей
DELETE FROM cart_items;
DO $$
BEGIN
  RAISE NOTICE '✅ Удалено: cart_items (товары в корзинах)';
END $$;

-- 2. Удалить все корзины (carts)
DELETE FROM carts;
DO $$
BEGIN
  RAISE NOTICE '✅ Удалено: carts (корзины)';
END $$;

-- 3. Удалить все items из заказов (order_items)
DELETE FROM order_items;
DO $$
BEGIN
  RAISE NOTICE '✅ Удалено: order_items (товары в заказах)';
END $$;

-- 4. Удалить все заказы (orders)
DELETE FROM orders;
DO $$
BEGIN
  RAISE NOTICE '✅ Удалено: orders (заказы)';
END $$;

-- 5. Удалить все тестовые товары (products)
DELETE FROM products;
DO $$
BEGIN
  RAISE NOTICE '✅ Удалено: products (каталог товаров)';
END $$;

-- 6. Удалить тестовых поставщиков (suppliers)
DELETE FROM suppliers;
DO $$
BEGIN
  RAISE NOTICE '✅ Удалено: suppliers (поставщики)';
END $$;

-- 7. Сбросить счетчики AUTO_INCREMENT для чистого старта
-- Это опционально, но делает ID более красивыми
ALTER SEQUENCE products_id_seq RESTART WITH 1;
ALTER SEQUENCE carts_id_seq RESTART WITH 1;
ALTER SEQUENCE cart_items_id_seq RESTART WITH 1;
ALTER SEQUENCE orders_id_seq RESTART WITH 1;
ALTER SEQUENCE order_items_id_seq RESTART WITH 1;

DO $$
BEGIN
  RAISE NOTICE '✅ Сброшены счетчики ID';
END $$;

-- 8. НЕ удаляем price_rules - они нужны для работы!
-- НЕ удаляем пользователей (auth.users) - они управляются Supabase Auth

-- Проверка результата
DO $$
DECLARE
  products_count INTEGER;
  suppliers_count INTEGER;
  carts_count INTEGER;
  orders_count INTEGER;
  price_rules_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO products_count FROM products;
  SELECT COUNT(*) INTO suppliers_count FROM suppliers;
  SELECT COUNT(*) INTO carts_count FROM carts;
  SELECT COUNT(*) INTO orders_count FROM orders;
  SELECT COUNT(*) INTO price_rules_count FROM price_rules;
  
  RAISE NOTICE '';
  RAISE NOTICE '📊 РЕЗУЛЬТАТ ОЧИСТКИ:';
  RAISE NOTICE '  - Товары (products): %', products_count;
  RAISE NOTICE '  - Поставщики (suppliers): %', suppliers_count;
  RAISE NOTICE '  - Корзины (carts): %', carts_count;
  RAISE NOTICE '  - Заказы (orders): %', orders_count;
  RAISE NOTICE '  - Правила цен (price_rules): % ← сохранены!', price_rules_count;
  RAISE NOTICE '';
  RAISE NOTICE '✅ База данных очищена!';
  RAISE NOTICE '🚀 Теперь товары будут подтягиваться только через API Berg.ru';
END $$;

