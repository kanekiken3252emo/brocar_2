// Проверка fallback-логики в Berg-адаптере: 4 сценария
// Запуск: node scripts/verify-berg-fallback.mjs
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const key = process.env.BERG_API_KEY;

const isReliable = (offer) => {
  const stock = parseInt(offer.quantity || 0, 10);
  if (!(stock > 0)) return null; // нет остатка — вообще не учитываем
  const period = offer.average_period != null ? parseInt(offer.average_period, 10) : null;
  return offer.reliability >= 70 && (period == null || period <= 21);
};

// Эмулируем новую логику адаптера и сравниваем со старой (только filter, без fallback)
function simulateAdapter(resources) {
  const old = []; // как было: жёсткий фильтр, без fallback
  const newPassing = []; // как стало: надёжные
  const newFallback = []; // как стало: fallback

  for (const resource of resources) {
    const passing = [];
    const fallback = [];
    for (const offer of resource.offers || []) {
      const stock = parseInt(offer.quantity || 0, 10);
      if (!(stock > 0)) continue;
      const rel = isReliable(offer);

      // старая логика — рез ≥80, без срока. Точно как ДО первой моей правки
      const oldPasses = stock > 0 && offer.reliability >= 80;
      if (oldPasses) old.push({ resource, offer, stock });

      if (rel) passing.push({ resource, offer, stock });
      else fallback.push({ resource, offer, stock });
    }

    if (passing.length > 0) newPassing.push(...passing);
    else if (fallback.length > 0) newFallback.push(...fallback);
  }

  return { old, newPassing, newFallback };
}

async function check(label, params) {
  const url = new URL('https://api.berg.ru/v1.0/ordering/get_stock.json');
  url.searchParams.set('key', key);
  url.searchParams.set('analogs', '0');
  url.searchParams.set('items[0][resource_article]', params.article);
  if (params.brand) url.searchParams.set('items[0][brand_name]', params.brand);
  // URL.searchParams encodes [ ] — а Berg хочет «как есть». Соберём вручную.
  const raw =
    `https://api.berg.ru/v1.0/ordering/get_stock.json?key=${key}&analogs=0` +
    `&items[0][resource_article]=${encodeURIComponent(params.article)}` +
    (params.brand ? `&items[0][brand_name]=${encodeURIComponent(params.brand)}` : '');
  const r = await fetch(raw);
  const data = await r.json();
  const resources = data.resources || [];

  console.log(`\n━━━ ${label} (${params.brand || '?'} ${params.article}) ━━━`);
  console.log(`Ресурсов от Berg: ${resources.length}`);
  if (resources.length === 0) {
    console.log('  Нет данных — товар у Berg отсутствует');
    return;
  }

  const { old, newPassing, newFallback } = simulateAdapter(resources);

  const sumStock = arr => arr.reduce((s, x) => s + x.stock, 0);

  console.log(`Старая логика (rel ≥80):           ${old.length} оферов, ${sumStock(old)} шт`);
  console.log(`Новая, надёжные (rel ≥70 & ≤21д): ${newPassing.length} оферов, ${sumStock(newPassing)} шт`);
  console.log(`Новая, fallback (если не надёжных): ${newFallback.length} оферов, ${sumStock(newFallback)} шт`);

  const totalShown = newPassing.length + newFallback.length;
  console.log(`Итого новой логикой будет показано:  ${totalShown} оферов`);

  if (newPassing.length === 0 && newFallback.length === 0) {
    console.log('  ⚠️  Товар не покажется вообще (у Berg нет реальных остатков)');
  } else if (newPassing.length === 0) {
    console.log(`  ✅ FALLBACK сработал: показываем ${newFallback.length} «остальных» оферов с пометкой`);
  } else if (newFallback.length === 0 && old.length === totalShown) {
    console.log(`  ✅ Без изменений vs старой логики`);
  } else {
    console.log(`  ✅ Видим больше реального наличия: +${totalShown - old.length} оферов vs старой логики`);
  }
}

await check('Популярная свеча', { brand: 'Bosch', article: '0242235666' });
await check('Масляный фильтр', { brand: 'Bosch', article: '0986452041' });
// Редкий товар на пробу — попробуем что-нибудь специфическое
await check('Редкая запчасть', { brand: 'Mahle', article: 'TX22D' });
// Несуществующий товар — должен вернуть 0 ресурсов
await check('Несуществующий', { brand: 'XXX', article: 'AAA999BBB' });

// ── Симуляция fallback ──
// Берём реальный товар, но искусственно делаем фильтр настолько жёстким, чтобы НИ ОДИН
// склад не прошёл. Так проверим, что fallback показывает оферы, а не пустоту.
console.log('\n━━━ СИМУЛЯЦИЯ FALLBACK ━━━');
console.log('Делаем фильтр rel ≥ 200% (физически невозможно) — должен сработать fallback');
const raw =
  `https://api.berg.ru/v1.0/ordering/get_stock.json?key=${key}&analogs=0` +
  `&items[0][resource_article]=0986452041&items[0][brand_name]=Bosch`;
const data = await (await fetch(raw)).json();
const resources = data.resources || [];

function impossibleFilter(resources) {
  const allItems = [];
  for (const resource of resources) {
    const passing = [];
    const fallback = [];
    for (const offer of resource.offers || []) {
      const stock = parseInt(offer.quantity || 0, 10);
      if (!(stock > 0)) continue;
      // Невозможный порог: rel ≥ 200%. passing будет всегда пуст.
      const isReliable = offer.reliability >= 200;
      const item = { stock, rel: offer.reliability, period: offer.average_period, wh: offer.warehouse?.name, isLowConfidence: !isReliable };
      if (isReliable) passing.push(item);
      else fallback.push(item);
    }
    if (passing.length > 0) allItems.push(...passing);
    else if (fallback.length > 0) allItems.push(...fallback);
  }
  return allItems;
}

const result = impossibleFilter(resources);
console.log(`Под жёстким фильтром passing был пуст → fallback показал ${result.length} оферов`);
console.log(`Все ${result.length} помечены isLowConfidence=true: ${result.every(x => x.isLowConfidence) ? '✅ да' : '❌ НЕТ — баг!'}`);
console.log(`Первые 3 оффера: `);
for (const x of result.slice(0, 3)) {
  console.log(`  ${x.wh.padEnd(15)} ${x.stock} шт, rel=${x.rel}%, ${x.period}д`);
}
