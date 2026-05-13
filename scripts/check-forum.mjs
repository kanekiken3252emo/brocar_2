// Проверка Forum-Auto API с правильными параметрами
// Запуск: node scripts/check-forum.mjs
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const login = process.env.FORUM_AUTO_LOGIN;
const pass = process.env.FORUM_AUTO_PASSWORD;
console.log(`Логин: ${login}`);
console.log(`Пароль: ${pass.slice(0, 3)}***${pass.slice(-2)} (длина ${pass.length})`);
console.log('');

// ── 1) Правильный endpoint /v2/listGoods c параметром pass=
console.log('━━━ /v2/listGoods (правильный) ━━━');
{
  const url = new URL('https://api.forum-auto.ru/v2/listGoods');
  url.searchParams.set('login', login);
  url.searchParams.set('pass', pass);
  url.searchParams.set('art', '0242235666');
  url.searchParams.set('br', 'Bosch');
  url.searchParams.set('cross', '0');
  const r = await fetch(url.toString());
  const txt = await r.text();
  console.log(`HTTP ${r.status}`);
  try {
    const data = JSON.parse(txt);
    if (Array.isArray(data)) {
      console.log(`✅ Найдено позиций: ${data.length}`);
      if (data.length > 0) {
        const first = data[0];
        console.log(`Пример: ${first.brand} ${first.art} «${first.name}» — ${first.num} шт × ${first.price}₽, склад ${first.whse}`);
        console.log(`Все поля: ${Object.keys(first).join(', ')}`);
        const hasImg = JSON.stringify(first).match(/img|image|picture|photo/i);
        console.log(`Картинки: ${hasImg ? `🖼 ${hasImg[0]}` : 'НЕТ'}`);
      }
    } else {
      console.log(`❌ Ошибка: ${JSON.stringify(data)}`);
    }
  } catch {
    console.log(`Не JSON: ${txt.slice(0, 300)}`);
  }
}

// ── 2) Список методов — может быть есть getGoodsImage или похожее
console.log('\n━━━ Проверка дополнительных методов ━━━');
const extraMethods = ['listGoodsPic', 'getGoodsImage', 'getPicture', 'getImages', 'getGoodsInfo', 'getInfo'];
for (const method of extraMethods) {
  const url = new URL(`https://api.forum-auto.ru/v2/${method}`);
  url.searchParams.set('login', login);
  url.searchParams.set('pass', pass);
  url.searchParams.set('art', '0242235666');
  url.searchParams.set('br', 'Bosch');
  try {
    const r = await fetch(url.toString());
    const txt = await r.text();
    let info = '';
    try {
      const data = JSON.parse(txt);
      if (data.error) info = `error ${data.error.code}: ${data.error.message}`;
      else if (Array.isArray(data)) info = `массив ${data.length}, поля: ${data[0] ? Object.keys(data[0]).join(',') : '—'}`;
      else info = JSON.stringify(data).slice(0, 150);
    } catch {
      info = txt.slice(0, 150);
    }
    console.log(`  ${method} → HTTP ${r.status}: ${info}`);
  } catch (e) {
    console.log(`  ${method} → ${e.message}`);
  }
}
