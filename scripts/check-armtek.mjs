// Проверка Armtek API с правильными endpoint'ами
// Запуск: node scripts/check-armtek.mjs
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const login = process.env.ARMTEK_LOGIN;
const pass = process.env.ARMTEK_PASSWORD;
const vkorg = process.env.ARMTEK_VKORG || '4000';
const kunnr = process.env.ARMTEK_KUNNR_RG;
const auth = 'Basic ' + Buffer.from(`${login}:${pass}`).toString('base64');

console.log(`Логин: ${login}, VKORG=${vkorg}, KUNNR_RG=${kunnr}`);
console.log('');

// ── 1) PING ── проверяем что API вообще нас пропускает
console.log('━━━ PING ━━━');
{
  const url = 'http://ws.armtek.ru/api/ws_ping/index?format=json';
  try {
    const r = await fetch(url, { headers: { Authorization: auth, Accept: 'application/json' } });
    const txt = await r.text();
    console.log(`HTTP ${r.status}`);
    console.log(`Ответ: ${txt.slice(0, 500)}`);
  } catch (e) {
    console.log(`Ошибка: ${e.message}`);
  }
}

// ── 2) SEARCH ── правильный endpoint и метод
console.log('\n━━━ SEARCH (POST /api/ws_search/search) ━━━');
{
  const body = new URLSearchParams({
    VKORG: vkorg,
    KUNNR_RG: kunnr,
    PIN: '0242235666',
    BRAND: 'Bosch',
    QUERY_TYPE: '2',
  }).toString();

  const url = 'http://ws.armtek.ru/api/ws_search/search?format=json';
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    });
    const txt = await r.text();
    console.log(`HTTP ${r.status}`);
    if (r.status === 200) {
      try {
        const data = JSON.parse(txt);
        console.log(`STATUS=${data.STATUS}, MESSAGES=${JSON.stringify(data.MESSAGES)?.slice(0, 200)}`);
        const resp = Array.isArray(data.RESP) ? data.RESP : [];
        console.log(`Найдено позиций: ${resp.length}`);
        if (resp.length > 0) {
          const first = resp[0];
          console.log(`Пример: ${first.BRAND} ${first.PIN} «${first.NAME}» — ${first.RVALUE} шт × ${first.PRICE} ${first.WAERS}, склад ${first.KEYZAK}`);
          console.log(`Все поля первого элемента: ${Object.keys(first).join(', ')}`);
          const hasImg = JSON.stringify(first).match(/img|image|picture|photo/i);
          console.log(`Картинки в полях: ${hasImg ? `🖼 ${hasImg[0]}` : 'НЕТ'}`);
        }
      } catch (e) {
        console.log(`Не JSON: ${txt.slice(0, 400)}`);
      }
    } else {
      console.log(`Тело ответа: ${txt.slice(0, 400)}`);
    }
  } catch (e) {
    console.log(`Ошибка: ${e.message}`);
  }
}

// ── 3) USERINFO ── проверяем что выдаёт сервис о клиенте (есть ли там IP whitelist)
console.log('\n━━━ USER INFO (POST /api/ws_user/getUserInfo) ━━━');
{
  const body = new URLSearchParams({ VKORG: vkorg, STRUCTURE: '1', FTPDATA: '1' }).toString();
  try {
    const r = await fetch('http://ws.armtek.ru/api/ws_user/getUserInfo?format=json', {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    });
    const txt = await r.text();
    console.log(`HTTP ${r.status}`);
    if (r.status === 200) {
      try {
        const data = JSON.parse(txt);
        console.log(`STATUS=${data.STATUS}`);
        console.log(`MESSAGES=${JSON.stringify(data.MESSAGES)?.slice(0, 300)}`);
        // прячем потенциально чувствительные поля при выводе
        const respStr = JSON.stringify(data.RESP || {}).slice(0, 800);
        console.log(`RESP (первые 800 симв): ${respStr}`);
      } catch {
        console.log(`Не JSON: ${txt.slice(0, 400)}`);
      }
    } else {
      console.log(`Тело: ${txt.slice(0, 400)}`);
    }
  } catch (e) {
    console.log(`Ошибка: ${e.message}`);
  }
}
