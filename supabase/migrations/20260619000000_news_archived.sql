-- Архив новостей: мягкое удаление.
-- archived = true → новость не показывается на сайте, но остаётся в БД
-- и видна в админке в разделе «Архив» (можно вернуть или удалить насовсем).
ALTER TABLE news
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

-- Главная грузит свежие неархивные новости — индекс под этот запрос.
CREATE INDEX IF NOT EXISTS news_archived_published_idx
  ON news (archived, published_at DESC);
