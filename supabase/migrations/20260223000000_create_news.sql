-- Таблица новостей
CREATE TABLE IF NOT EXISTS news (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  badge       TEXT,                          -- метка: "Режим работы", "Акция" и т.д.
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Публичное чтение (новости видят все)
ALTER TABLE news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "news_public_read" ON news
  FOR SELECT USING (true);

-- Первая новость: 23 февраля
INSERT INTO news (title, body, badge, published_at) VALUES (
  '23 февраля — выходной день',
  'Поздравляем защитников Отечества! 23 февраля магазин не работает — с 24-го работаем в обычном режиме.',
  'Режим работы',
  '2026-02-23 00:00:00+05'
);
