// Сравнение: что Berg отдаёт в API vs что показываем на сайте
// Запуск: node scripts/check-berg-stock.mjs
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const key = process.env.BERG_API_KEY;

// Тестируем на популярных артикулах
const tests = [
  { article: '0242235666', brand: 'Bosch', name: 'Свеча зажигания' },
  { article: '0986452041', brand: 'Bosch', name: 'Масляный фильтр' },
];

for (const t of tests) {
  console.log(`\n━━━ ${t.brand} ${t.article} (${t.name}) ━━━`);
  const url = `https://api.berg.ru/v1.0/ordering/get_stock.json?key=${key}&analogs=0&items[0][resource_article]=${t.article}&items[0][brand_name]=${t.brand}`;
  const r = await fetch(url);
  const data = await r.json();
  const resources = data.resources || [];

  if (!resources.length) {
    console.log('  Нет данных');
    continue;
  }

  for (const res of resources) {
    console.log(`\nРесурс: ${res.brand?.name} ${res.article} — «${res.name}»`);
    const offers = res.offers || [];
    console.log(`Всего офферов от Berg: ${offers.length}`);

    let totalAll = 0;
    let totalFiltered = 0;
    let countAll = 0;
    let countFiltered = 0;

    console.log('\nВсе склады:');
    console.log('  Склад'.padEnd(30) + 'Кол-во'.padEnd(10) + 'Цена'.padEnd(10) + 'Надёжн.'.padEnd(10) + 'Срок' + '  ПОПАДАЕТ?');

    for (const o of offers) {
      const qty = parseInt(o.quantity || 0, 10);
      const price = parseFloat(o.price || 0);
      const rel = o.reliability ?? 0;
      const wh = (o.warehouse?.name || '?').slice(0, 28);
      const period = o.average_period ?? '?';

      totalAll += qty;
      countAll += 1;

      // Новый фильтр: quantity > 0 AND reliability >= 70 AND срок <= 21 день
      const periodN = typeof o.average_period === 'number' ? o.average_period : parseInt(o.average_period, 10);
      const periodOk = !Number.isFinite(periodN) || periodN <= 21;
      const passes = qty > 0 && rel >= 70 && periodOk;
      if (passes) {
        totalFiltered += qty;
        countFiltered += 1;
      }

      console.log(
        '  ' +
        wh.padEnd(30) +
        String(qty).padEnd(10) +
        String(price).padEnd(10) +
        String(rel + '%').padEnd(10) +
        String(period + 'д').padEnd(6) +
        (passes ? '  ✅' : '  ❌ отброшен')
      );
    }

    console.log('');
    console.log(`API Berg отдаёт:        ${countAll} складов, всего ${totalAll} шт.`);
    console.log(`Сайт показывает:        ${countFiltered} складов, всего ${totalFiltered} шт.`);
    if (totalAll !== totalFiltered) {
      console.log(`⚠️  РАЗНИЦА:             −${totalAll - totalFiltered} шт. (отброшено ${countAll - countFiltered} складов из-за reliability < 80%)`);
    } else {
      console.log(`✅ Совпадает`);
    }
  }
}
