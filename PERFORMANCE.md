# ⚡ Производительность загрузки

Где терялось время (по замерам прода + параллельному аудиту):
1. **Клиентский водопад каталога** — товары рисуются только после загрузки JS и
   запроса к API (шелл → JS → fetch → рендер → картинки).
2. **Нет кэша** — ни один роут каталога не кэширован, перед Next нет кэш-слоя
   (nginx без `proxy_cache`); каждый заход = полный round-trip к Supabase (cold до 3.4с).
3. **Оверхед на каждый запрос** — auth-round-trip в middleware у залогиненных,
   повторная оптимизация уже готовых S3-картинок, сломанная связка шрифта.

---

## ✅ Сделано (в коде, задеплоится с push)

| Оптимизация | Что |
|---|---|
| Шрифт Inter | Связка `var(--font-inter)` починена (грузился, но не применялся), веса 7→4, `display:swap` |
| Middleware | matcher сужен до `/dashboard`,`/admin` — нет auth-round-trip на каждый запрос/`/api` |
| Cache-Control | На всех публичных роутах каталога (`lib/http-cache.ts`) |
| Картинки | S3 отдаются напрямую (`unoptimized`) — без второго прохода `/_next/image` |
| preconnect | К CDN картинок (VK Cloud) в `layout` |
| JS | `optimizePackageImports: lucide-react` |
| Главная | `page.tsx` + `BrandCatalogHero` → серверные компоненты |

---

## 🟡 Применить на VPS — nginx micro-cache (включает весь кэш-слой)

Без этого `s-maxage` из роутов **некому исполнять** для анонимов. Это самый
быстрый прирост для повторных заходов (TTFB ~10мс) и устранение cold-start.

```bash
# 1. Скопировать кэш-конфиг (http-контекст) и создать каталог кэша
sudo cp /var/www/brocar/nginx-cache.conf /etc/nginx/conf.d/brocar-cache.conf
sudo mkdir -p /var/cache/nginx/brocar && sudo chown -R www-data:www-data /var/cache/nginx

# 2. В server-блоке живого конфига (/etc/nginx/sites-available/brocar, где SSL от
#    certbot) добавить location для кэша каталога и перевести proxy_pass на upstream.
#    Готовый пример с этим блоком — /var/www/brocar/nginx.conf (location ~ ^/api/(catalog|product-image)).
#    Скопировать оттуда location-блок в свой server{} (и в 80, и в 443 при наличии),
#    proxy_pass http://localhost:3000 → http://brocar_next.
sudo nano /etc/nginx/sites-available/brocar

# 3. Проверить и применить
sudo nginx -t && sudo systemctl reload nginx

# 4. Проверка: повторный запрос должен отдавать X-Cache-Status: HIT
curl -s -D - -o /dev/null "https://www.brocarparts.ru/api/catalog/category/batteries?sort=price-asc&page=1&limit=20" | grep -i x-cache
```

**Безопасность кэша:** кэшируется ТОЛЬКО `/api/catalog/*` и `/api/product-image`,
и ТОЛЬКО при отсутствии cookie (`$brocar_no_cache`) — корзина, профиль, админка,
auth никогда не попадут в общий кэш. Меню/категории и так суточные.

После включения gzip в nginx можно (опционально) выключить дублирующее сжатие в
Next: `compress: false` в `next.config.ts`.

---

## 🟡 Средние оптимизации (код, в работе)

- Частичный индекс `products(category_slug, our_price) WHERE stock>0` — быстрее
  выбор первых 20 по цене на категориях с распроданными позициями.
- Свернуть 8 round-trip'ов категории → 4 (count+бренды+фасеты одним CTE).
- Страница товара: засеять главное фото на сервере + `priority` — убрать второй
  водопад `/api/product-image` для LCP-картинки.
- Кэш на `/api/product/[article]` (живой опрос 7 поставщиков на каждый заход).
- `lookupCachedBatch`: OR-цепочка из 200 пар → row-constructor `IN` (index-scan).
- `unstable_cache` (Next Data Cache) на меню categories/car-brands + сброс из
  ночного импорта (`revalidateTag`).
- Новости главной — с клиента на сервер (убрать supabase-js из бандла главной).
- Прогрев пула DB реальными запросами (не только `SELECT 1`).

---

## 🔴 Большое (корень жалобы «медленно грузятся товары»)

**Каталог категории/бренда → серверный рендер (RSC) + streaming.** Сейчас
`app/catalog/page.tsx` целиком `'use client'`: товары приходят на
`TTFB_html + JS + TTFB_api` вместо одного `TTFB`. План: вынести загрузку категории
в серверную функцию, отрендерить заголовок + сетку карточек с начальными данными
на сервере (картинки с готовыми `src` едут сразу в HTML), фильтры/сортировку/
пагинацию оставить клиентским островом, список обернуть в `<Suspense>`.
Аналогично — страница товара. Это рефакторинг → делать отдельным шагом с проверкой.
