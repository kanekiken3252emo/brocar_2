# Картинки товаров

Источник картинок — **ShATE-M API**. Картинки кэшируются в Supabase Storage и в
таблице `product_images` лениво (при первом запросе товара). Остальные
поставщики (Берг, Армтек, Россько, Forum-Auto) изображения через API не отдают
— у них в каталоге используется одна и та же картинка (бренд+артикул), которую
мы получаем через ShATE-M.

## Архитектура

```
Клиент (карточка/каталог/корзина)
    └── ProductImage  ──▶ /api/product-image?brand=…&article=…
                              └── lib/product-images.ts: getOrFetchProductImage
                                    ├── читает кэш product_images (BD)
                                    └── если нет:
                                        ├── ShATE-M findArticleId(article, brand)
                                        ├── ShATE-M getArticleContents(articleId)
                                        ├── ShATE-M fetchContent(contentId)  → base64
                                        ├── Upload → Supabase Storage (bucket product-images)
                                        └── INSERT product_images (brand, article, image_url)
```

Если ShATE-M не нашёл картинку — пишется **negative cache** (`image_url = NULL`),
чтобы не дёргать API повторно для отсутствующих позиций.

## Однократная настройка

### 1. Применить миграцию БД

```sql
-- supabase/migrations/20260522000000_create_product_images.sql
```

Запустить через Supabase Dashboard → SQL Editor, либо `supabase db push` если
настроен Supabase CLI.

### 2. Создать Storage-бакет

В Supabase Dashboard → Storage → New bucket:

- **Name**: `product-images`
- **Public bucket**: включить (картинки нужны без авторизации)
- File size limit: 5 MB (картинки ShATE-M ~50-200 KB)
- Allowed MIME types: `image/webp,image/jpeg,image/png` (опционально)

### 3. Env-переменные

Проверить что в `.env.local` есть:

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=…           # для загрузки картинок в Storage
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co  # для next.config.ts
SHATE_M_API_KEY=…
```

`SHATE_M_AGREEMENT_CODE` / `SHATE_M_DELIVERY_ADDRESS_CODE` для картинок **не
требуются** — они нужны только методу `search()` для цен.

После правки `NEXT_PUBLIC_SUPABASE_URL` перезапустить `next dev` — хост
Supabase Storage берётся в `next.config.ts` именно из этой переменной.

## Поведение

- **Первый показ товара**: запрос `/api/product-image` → ShATE-M → загрузка в
  Storage. Задержка 500–2000 мс. В это время на фронте отображается
  плейсхолдер `/photo-soon.png`, потом картинка подтягивается.
- **Повторный показ**: ответ из БД-кэша, ~30 мс. URL ведёт прямиком в Supabase
  Storage CDN, картинка отдаётся быстро.
- **ShATE-M не знает товар**: negative cache, в БД лежит строка с
  `image_url = NULL`, при повторном запросе сразу возвращается плейсхолдер
  без обращения к ShATE-M.

## Отладка

- **Картинка не появляется**: открой DevTools → Network → запрос
  `/api/product-image` — посмотри ответ. `{ url: null }` означает, что
  ShATE-M не вернул контент (товар не в их каталоге или нет картинок).
- **Ошибка 500 от `/api/product-image`**: проверь логи сервера. Чаще всего
  это отсутствие `SUPABASE_SERVICE_ROLE_KEY` или отсутствие бакета
  `product-images`.
- **`next/image` ругается на hostname**: проверь, что в `next.config.ts`
  `remotePatterns` сгенерировался правильно — нужен корректный
  `NEXT_PUBLIC_SUPABASE_URL`.
- **Сбросить негативный кэш для одного товара**:
  ```sql
  delete from product_images where brand = '…' and article = '…';
  ```

## Что НЕ покрыто

- Картинки от Берга — у них в API нет такого метода (см. `lib/suppliers/berg.ts`).
- Если ShATE-M не знает товар — плейсхолдер. На будущее можно прикрутить
  скрейпинг публичной витрины Берга или интеграцию с TecDoc.
