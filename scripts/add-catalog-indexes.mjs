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
