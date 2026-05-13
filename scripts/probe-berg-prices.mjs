// Ищем endpoint Berg, который вернёт клиентскую цену (255,29 ₽), а не базовую (183 ₽)
// Запуск: node scripts/probe-berg-prices.mjs
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const key = process.env.BERG_API_KEY;
const ARTICLE = '0242235666';
const BRAND = 'BOSCH';
const RESOURCE_ID = 132822;

console.log('Ищем endpoint Berg, который вернёт цену 255,29₽ (из кабинета), а не 183₽ (из get_stock)\n');

// Возможные endpoint'ы Berg API
const tests = [
  // Разные параметры на тот же get_stock
  { name: 'get_stock + price_type=client', url: `https://api.berg.ru/v1.0/ordering/get_stock.json?key=${key}&analogs=0&price_type=client&items[0][resource_article]=${ARTICLE}&items[0][brand_name]=${BRAND}` },
  { name: 'get_stock + price=retail', url: `https://api.berg.ru/v1.0/ordering/get_stock.json?key=${key}&analogs=0&price=retail&items[0][resource_article]=${ARTICLE}&items[0][brand_name]=${BRAND}` },
  { name: 'get_stock + with_markup=1', url: `https://api.berg.ru/v1.0/ordering/get_stock.json?key=${key}&analogs=0&with_markup=1&items[0][resource_article]=${ARTICLE}&items[0][brand_name]=${BRAND}` },
  // Альтернативные endpoint'ы
  { name: 'get_prices', url: `https://api.berg.ru/v1.0/ordering/get_prices.json?key=${key}&resource_id=${RESOURCE_ID}` },
  { name: 'get_price', url: `https://api.berg.ru/v1.0/ordering/get_price.json?key=${key}&resource_id=${RESOURCE_ID}` },
  { name: 'get_client_price', url: `https://api.berg.ru/v1.0/ordering/get_client_price.json?key=${key}&resource_id=${RESOURCE_ID}` },
  { name: 'get_offers', url: `https://api.berg.ru/v1.0/ordering/get_offers.json?key=${key}&resource_id=${RESOURCE_ID}` },
  // Прямой запрос по resource_id
  { name: 'get_stock by resource_id', url: `https://api.berg.ru/v1.0/ordering/get_stock.json?key=${key}&analogs=0&items[0][resource_id]=${RESOURCE_ID}` },
  // Поиск/search
  { name: 'search', url: `https://api.berg.ru/v1.0/ordering/search.json?key=${key}&q=${ARTICLE}` },
  // Информация о клиенте
  { name: 'get_user_info', url: `https://api.berg.ru/v1.0/clients/get_info.json?key=${key}` },
  { name: 'get_contracts', url: `https://api.berg.ru/v1.0/clients/get_contracts.json?key=${key}` },
];

for (const t of tests) {
  try {
    const r = await fetch(t.url);
    const txt = await r.text();
    let info = '';
    if (r.status === 200) {
      try {
        const data = JSON.parse(txt);
        // Ищем цены в ответе
        const text = JSON.stringify(data);
        const priceMatches = text.match(/"price[^"]*":\s*[\d.]+/g) || [];
        const uniquePrices = new Set(priceMatches.map(m => m.match(/[\d.]+$/)?.[0]));
        info = `OK, ${txt.length} bytes, цены в ответе: ${[...uniquePrices].slice(0, 10).join(', ') || 'нет'}`;
        // Если есть 255 или близкая — это золото
        if (text.includes('255.29') || text.includes('255,29') || text.includes('"255"')) {
          info += '  🎯 НАЙДЕНА ЦЕНА 255!';
        }
      } catch {
        info = `не JSON: ${txt.slice(0, 100)}`;
      }
    } else {
      info = `HTTP ${r.status}: ${txt.slice(0, 100)}`;
    }
    console.log(`  ${t.name.padEnd(45)} → ${info}`);
  } catch (e) {
    console.log(`  ${t.name.padEnd(45)} → error: ${e.message}`);
  }
}
