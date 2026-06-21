-- Индекс по НОРМАЛИЗОВАННОМУ артикулу для серверного шелла карточки товара.
-- Ссылка карточки несёт нормализованный артикул (normalizeArticle: убрать
-- не-буквенно-цифровые символы + UPPER). Серверный getShell (lib/suppliers/db-group.ts)
-- ищет товар по этому же выражению. Без индекса был ilike(article) → seq scan по
-- ~768k товаров на КАЖДЫЙ заход в карточку (~9 сек). С индексом — Index Scan ~5мс.
--
-- ВАЖНО: выражение обязано совпадать символ-в-символ с normalizeArticle
-- (lib/suppliers/adapter.ts) и с запросом в db-group.ts, иначе индекс не применится.
CREATE INDEX IF NOT EXISTS idx_products_norm_article
  ON products (upper(regexp_replace(article, '[^0-9A-Za-zА-Яа-я]', '', 'g')));
