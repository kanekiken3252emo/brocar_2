#!/usr/bin/env node
/**
 * Разовая чистка каталога от позиций с битой ценой — наследие старых импортов
 * (в основном Армтек в «АЛЬТ-формате»: NaN в numeric-колонке цены или баркод-
 * мусор в сотни млн–триллионы ₽). Такие позиции ломали сортировку «по убыванию»
 * и роняли рендер каталога (см. фикс в роутах + isValidPrice/MAX_PLAUSIBLE_PRICE
 * в lib/suppliers/adapter.ts). Каталог их уже прячет фильтром в SQL — этот скрипт
 * убирает их из БД насовсем (поиск по названию, прямые ссылки, гигиена данных).
 *
 * Запуск (Node 22+):
 *   node --env-file=.env.local scripts/cleanup-garbage-prices.mjs          # DRY: только показать, что будет затронуто
 *   node --env-file=.env.local scripts/cleanup-garbage-prices.mjs --apply  # выполнить удаление (необратимо!)
 *
 * Что делает в --apply (одной транзакцией):
 *   1. order_items.product_id → NULL для битых товаров. История заказа цела:
 *      name/article/price/qty в order_items хранятся снимком, а не по ссылке.
 *   2. Удаляет cart_items, ссылающиеся на битые товары (корзины — временные).
 *   3. Удаляет битые products (ON DELETE CASCADE автоматически убирает их
 *      product_stocks).
 *   4. Подчищает оставшиеся битые product_stocks у уцелевших товаров.
 *
 * «Битая цена» = NaN, либо ≤ 0, либо ≥ MAX_PLAUSIBLE_PRICE.
 */
import postgres from "postgres";

const APPLY = process.argv.includes("--apply");
const DB_URL = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
// Должно совпадать с MAX_PLAUSIBLE_PRICE в lib/suppliers/adapter.ts.
const MAX = 50_000_000;

if (!DB_URL) {
  console.error("❌ DATABASE_URL не задан (DATABASE_POOLER_URL/DATABASE_URL).");
  process.exit(1);
}

const isPooler = DB_URL.includes("pooler.supabase.com");
const sql = postgres(DB_URL, {
  max: 3,
  idle_timeout: 30,
  connect_timeout: 30,
  ssl: "require",
  prepare: !isPooler,
});

async function main() {
  console.log(`🧹 Чистка битых цен${APPLY ? " (APPLY — будет удаление!)" : " (DRY-RUN)"}`);
  console.log(`   Порог нереальной цены: ${MAX.toLocaleString("ru-RU")} ₽\n`);

  // Разбивка битых products по типу мусора (категории взаимоисключающие):
  //   nan    — our_price = NaN (Postgres хранит как валидный numeric)
  //   nonpos — реальная цена ≤ 0
  //   huge   — реальная цена ≥ MAX (баркод-мусор)
  const [bd] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE our_price = 'NaN'::numeric)::int AS nan,
      COUNT(*) FILTER (WHERE our_price <> 'NaN'::numeric AND our_price <= 0)::int AS nonpos,
      COUNT(*) FILTER (WHERE our_price <> 'NaN'::numeric AND our_price >= ${MAX})::int AS huge
    FROM products
  `;
  const totalBadProd = bd.nan + bd.nonpos + bd.huge;

  const [{ count: badStock }] = await sql`
    SELECT COUNT(*)::int AS count FROM product_stocks
    WHERE our_price = 'NaN'::numeric OR our_price <= 0 OR our_price >= ${MAX}
  `;

  console.log("   Битых products:");
  console.log(`     • NaN-цена:        ${bd.nan}`);
  console.log(`     • цена ≤ 0:         ${bd.nonpos}`);
  console.log(`     • цена ≥ порога:    ${bd.huge}`);
  console.log(`     ───────────────────────`);
  console.log(`     ИТОГО products:    ${totalBadProd}`);
  console.log(`   Битых product_stocks: ${badStock}`);

  // Примеры — топ-10 по цене (NaN сортируется выше всех при DESC).
  const samples = await sql`
    SELECT id, brand, article, our_price::text AS our_price, source
    FROM products
    WHERE our_price = 'NaN'::numeric OR our_price <= 0 OR our_price >= ${MAX}
    ORDER BY our_price DESC
    LIMIT 10
  `;
  if (samples.length) {
    console.log("\n   Примеры (топ-10 по цене):");
    for (const s of samples) {
      console.log(
        `     #${s.id}  ${s.brand} ${s.article} — ${s.our_price} ₽  [${s.source}]`
      );
    }
  }

  // Сколько заказов/корзин затронем.
  const [{ count: orderRefs }] = await sql`
    SELECT COUNT(*)::int AS count FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE p.our_price = 'NaN'::numeric OR p.our_price <= 0 OR p.our_price >= ${MAX}
  `;
  const [{ count: cartRefs }] = await sql`
    SELECT COUNT(*)::int AS count FROM cart_items ci
    JOIN products p ON p.id = ci.product_id
    WHERE p.our_price = 'NaN'::numeric OR p.our_price <= 0 OR p.our_price >= ${MAX}
  `;
  console.log(`\n   Ссылок из order_items: ${orderRefs} → станут NULL (снимок заказа сохранится)`);
  console.log(`   Ссылок из cart_items:  ${cartRefs} → будут удалены`);

  if (totalBadProd === 0 && badStock === 0) {
    console.log("\n✅ Битых цен не найдено — чистить нечего.");
    await sql.end();
    return;
  }

  if (!APPLY) {
    console.log("\nℹ️  DRY-RUN: БД не тронута. Запусти с --apply, чтобы выполнить удаление.");
    await sql.end();
    return;
  }

  console.log("\n⚙️  Применяю (в транзакции)…");
  await sql.begin(async (tx) => {
    // 1. Отвязываем битые товары от заказов (история остаётся в снимке order_items).
    const unlinked = await tx`
      UPDATE order_items SET product_id = NULL
      WHERE product_id IN (
        SELECT id FROM products
        WHERE our_price = 'NaN'::numeric OR our_price <= 0 OR our_price >= ${MAX}
      )
    `;
    // 2. Удаляем битые товары из корзин.
    const cartDel = await tx`
      DELETE FROM cart_items
      WHERE product_id IN (
        SELECT id FROM products
        WHERE our_price = 'NaN'::numeric OR our_price <= 0 OR our_price >= ${MAX}
      )
    `;
    // 3. Удаляем сами битые товары (cascade убирает их product_stocks).
    const prodDel = await tx`
      DELETE FROM products
      WHERE our_price = 'NaN'::numeric OR our_price <= 0 OR our_price >= ${MAX}
    `;
    // 4. Подчищаем оставшиеся битые остатки у уцелевших товаров.
    const stockDel = await tx`
      DELETE FROM product_stocks
      WHERE our_price = 'NaN'::numeric OR our_price <= 0 OR our_price >= ${MAX}
    `;
    console.log(`   ✓ order_items отвязано: ${unlinked.count}`);
    console.log(`   ✓ cart_items удалено:   ${cartDel.count}`);
    console.log(`   ✓ products удалено:     ${prodDel.count}`);
    console.log(`   ✓ product_stocks удалено (доп.): ${stockDel.count}`);
  });

  console.log("\n✅ Готово. Каталог очищен от битых цен.");
  await sql.end();
}

main().catch((e) => {
  console.error("\n❌ Ошибка:", e.message || e);
  process.exit(1);
});
