// Составные индексы для ускорения каталога (категория + цена/бренд).
// Запуск:  npm run db:catalog-idx   (идемпотентно; CONCURRENTLY не блокирует сайт)
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    try {
      const txt = readFileSync(resolve(process.cwd(), f), "utf8");
      for (const line of txt.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
        if (m && !process.env[m[1]]) {
          let v = m[2].trim();
          if (
            (v.startsWith('"') && v.endsWith('"')) ||
            (v.startsWith("'") && v.endsWith("'"))
          ) {
            v = v.slice(1, -1);
          }
          process.env[m[1]] = v;
        }
      }
    } catch {
      // нет файла — ок
    }
  }
}
loadEnv();

const url = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("❌ Нет DATABASE_POOLER_URL / DATABASE_URL в .env.local");
  process.exit(1);
}

const sql = postgres(url, {
  ssl: url.includes("supabase.com") ? "require" : undefined,
  prepare: !url.includes("pooler.supabase.com"),
  max: 1,
  idle_timeout: 20,
  connect_timeout: 15,
});

// CONCURRENTLY нельзя в транзакции — выполняем отдельными запросами.
const indexes = [
  // ★ ГЛАВНЫЙ ФИКС скорости каталога. На КАЖДУЮ загрузку категории (а также
  // карточки товара и поиска) идёт запрос остатков:
  //     SELECT * FROM product_stocks WHERE product_id IN (…)
  // Под внешний ключ product_id Postgres индекс НЕ создаёт автоматически, а
  // таблица product_stocks огромная (строка на товар×склад×поставщик, миллионы
  // строк). Без индекса это полный перебор всей таблицы при каждом открытии
  // ЛЮБОЙ категории → отсюда «тормозят все». С индексом — мгновенная выборка
  // по 20 id текущей страницы.
  {
    name: "idx_product_stocks_product_id",
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_stocks_product_id ON product_stocks (product_id)",
  },
  // Главный запрос страницы: WHERE category_slug=… ORDER BY our_price → индекс
  // отдаёт сразу нужные строки без сортировки всей категории.
  {
    name: "idx_products_cat_price",
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_cat_price ON products (category_slug, our_price)",
  },
  // Список брендов категории (SELECT DISTINCT brand WHERE category_slug=…) —
  // становится index-only, без чтения строк из кучи.
  {
    name: "idx_products_cat_brand",
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_cat_brand ON products (category_slug, brand)",
  },
  // COUNT(*) и DISTINCT brand считаются ТОЛЬКО по товарам в наличии (stock>0).
  // Частичный индекс с предикатом WHERE stock>0 делает и подсчёт, и список
  // брендов index-only — без heap-проверки stock по каждой строке категории.
  {
    name: "idx_products_cat_brand_instock",
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_cat_brand_instock ON products (category_slug, brand) WHERE stock > 0",
  },
  // Главный page-запрос: WHERE category_slug=… AND stock>0 AND our_price>0
  // ORDER BY our_price LIMIT 20. Частичный индекс по цене ТОЛЬКО для товаров в
  // наличии — первые 20 по цене берутся прямо из индекса, без heap-проверки
  // stock у распроданных позиций (на категориях с большой долей out-of-stock
  // это лишние чтения). Дополняет idx_products_cat_price (без предиката).
  {
    name: "idx_products_cat_price_instock",
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_cat_price_instock ON products (category_slug, our_price) WHERE stock > 0",
  },
  // Сортировка каталога «По названию» (sort=name): ORDER BY name. Без этого
  // индекса Postgres сканировал и сортировал ВСЕ товары категории (14k+) на
  // лету — замер показал 3.3с против 0.13с с индексом.
  {
    name: "idx_products_cat_name_instock",
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_cat_name_instock ON products (category_slug, name) WHERE stock > 0",
  },
  // Страница МАРКИ авто (car-brand): WHERE car_brands @> ARRAY[…] ORDER BY
  // our_price LIMIT 20. car_brands — массив (GIN-индекс), его НЕЛЬЗЯ btree-
  // индексировать с сортировкой → планировщик находил все товары марки (12k+) и
  // сортировал по цене на лету (3.4с холодная). С btree-индексом по цене он идёт
  // по нему в порядке цены и фильтрует марку, останавливаясь на 20 (~0.4с / 1мс exec).
  {
    name: "idx_products_price_instock",
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_price_instock ON products (our_price) WHERE stock > 0",
  },
  // Меню/хаб каталога: SELECT category_slug, COUNT(*) ... WHERE source='berg'
  // AND stock>0 GROUP BY category_slug. Без покрывающего индекса сканировал все
  // berg-товары (~49k) и читал category_slug из кучи — 4.8с холодная. Index-only → 0.2с.
  {
    name: "idx_products_source_cat",
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_source_cat ON products (source, category_slug) WHERE stock > 0",
  },
  // ── Внешние ключи без авто-индекса ────────────────────────────────────────
  // Postgres НЕ создаёт индекс под FK автоматически. order_items.order_id и
  // cart_items.cart_id растут со ВСЕМ магазином, а выбираются по одному заказу/
  // корзине. Без индекса каждый просмотр заказа (/order/[id], /garage, /admin/
  // orders, /dashboard) и любое действие с корзиной (открытие, +/-, бейдж в
  // хедере) делают seq scan по всей таблице. cart_items дёргается особенно часто.
  {
    name: "idx_order_items_order_id",
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id ON order_items (order_id)",
  },
  {
    name: "idx_cart_items_cart_id",
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cart_items_cart_id ON cart_items (cart_id)",
  },
  // Лист заказов (админка/дашборд): ORDER BY created_at DESC. Без индекса —
  // seq scan + сортировка всей таблицы orders на каждый заход.
  {
    name: "idx_orders_created_at",
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC)",
  },
  // ── Триграммный поиск (pg_trgm) ───────────────────────────────────────────
  // text-search Tier1/2 строят LIKE '%слово%' (ведущий wildcard) — btree их не
  // берёт, нужен GIN trgm. Раньше эти индексы ставил только разовый
  // scripts/enable-fuzzy-search.mjs; дублируем сюда, чтобы прод не зависел от
  // ручного запуска (если расширение/индекса нет — поиск молча уходит в seq scan).
  // Выражение ДОЛЖНО совпадать символ-в-символ с NAME_NORM в text-search route и
  // FOLD_FROM/FOLD_TO (lib/catalog/fold.mjs) — иначе индекс не применится.
  {
    name: "pg_trgm extension",
    ddl: "CREATE EXTENSION IF NOT EXISTS pg_trgm",
  },
  {
    name: "idx_products_name_trgm",
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_name_trgm ON products USING gin (translate(lower(name), 'ёabcehkmoptxy', 'еавсенкмортху') gin_trgm_ops)",
  },
  {
    name: "idx_products_article_trgm",
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_article_trgm ON products USING gin (lower(article) gin_trgm_ops)",
  },
  // Карточка товара: серверный шелл (getShell → findDbProductGroup) ищет товар по
  // НОРМАЛИЗОВАННОМУ артикулу (как в ссылке карточки — normalizeArticle: strip
  // не-буквенно-цифровых + upper). Без этого индекса был ilike(article) → seq scan
  // по ~768k товаров на КАЖДЫЙ заход в карточку (~9 сек!). Выражение обязано
  // совпадать с normalizeArticle (lib/suppliers/adapter.ts) и с запросом в db-group.ts.
  {
    name: "idx_products_norm_article",
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_norm_article ON products (upper(regexp_replace(article, '[^0-9A-Za-zА-Яа-я]', '', 'g')))",
  },
];

try {
  for (const idx of indexes) {
    console.log(`⏳ Строю ${idx.name} (CONCURRENTLY, может занять минуту)…`);
    await sql.unsafe(idx.ddl);
    console.log(`✅ ${idx.name} готов`);
  }
  console.log("🎉 Индексы каталога созданы");
} catch (e) {
  console.error("❌ Ошибка:", e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
