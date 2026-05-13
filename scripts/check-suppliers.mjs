// Проверка валидности API-ключей всех поставщиков
// Запуск: node scripts/check-suppliers.mjs
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Грузим .env.local
const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

// Тестовый артикул — свечи Bosch FR7DC (массовая позиция)
const TEST_ARTICLE = '0242235666';
const TEST_BRAND = 'Bosch';

const result = (name, ok, detail) =>
  console.log(`${ok ? '✅' : '❌'} ${name.padEnd(12)} — ${detail}`);

// ────────────────────────────────────────────
async function checkBerg() {
  const key = process.env.BERG_API_KEY;
  if (!key) return result('Berg', false, 'нет ключа');
  try {
    const url = `https://api.berg.ru/v1.0/ordering/get_stock.json?key=${key}&analogs=0&items[0][resource_article]=${encodeURIComponent(TEST_ARTICLE)}&items[0][brand_name]=${encodeURIComponent(TEST_BRAND)}`;
    const r = await fetch(url);
    const status = r.status;
    const txt = await r.text();
    if (status === 200) {
      const data = JSON.parse(txt);
      const count = data.resources?.length || 0;
      const firstOffer = data.resources?.[0]?.offers?.[0];
      const hasImg = JSON.stringify(data).match(/image|picture|photo/i);
      result('Berg', true, `OK, ресурсов: ${count}, первый офер: ${firstOffer ? `${firstOffer.quantity} шт × ${firstOffer.price}₽` : '—'}, картинка в ответе: ${hasImg ? 'ДА' : 'нет'}`);
    } else {
      result('Berg', false, `HTTP ${status}: ${txt.slice(0, 200)}`);
    }
  } catch (e) {
    result('Berg', false, e.message);
  }
}

// ────────────────────────────────────────────
async function checkRossko() {
  const k1 = process.env.ROSSKO_KEY1;
  const k2 = process.env.ROSSKO_KEY2;
  if (!k1 || !k2) return result('Rossko', false, 'нет ключей');
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://api.rossko.ru/">
  <soap:Body><tns:GetSearch>
    <KEY1>${k1}</KEY1><KEY2>${k2}</KEY2>
    <text>${TEST_BRAND} ${TEST_ARTICLE}</text>
    <delivery_id>${process.env.ROSSKO_DELIVERY_ID || '000000001'}</delivery_id>
    <address_id>${process.env.ROSSKO_ADDRESS_ID || '270997'}</address_id>
  </tns:GetSearch></soap:Body></soap:Envelope>`;
  try {
    const r = await fetch('http://api.rossko.ru/service/v2.1/GetSearch', {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: 'GetSearch' },
      body: envelope,
    });
    const txt = await r.text();
    if (r.status === 200) {
      const hasError = txt.match(/<faultstring>([^<]+)/);
      if (hasError) return result('Rossko', false, `SOAP: ${hasError[1]}`);
      const count = (txt.match(/<PartNumber>/g) || []).length;
      const hasImg = txt.match(/picture|image|photo/i);
      result('Rossko', true, `OK, позиций: ${count}, картинка в ответе: ${hasImg ? `ДА (${hasImg[0]})` : 'нет'}`);
    } else {
      result('Rossko', false, `HTTP ${r.status}`);
    }
  } catch (e) {
    result('Rossko', false, e.message);
  }
}

// ────────────────────────────────────────────
async function checkShateM() {
  const key = process.env.SHATE_M_API_KEY;
  if (!key) return result('ShATE-M', false, 'нет ключа');
  try {
    // 1. Логин
    const auth = await fetch('https://api.shate-m.ru/api/v1/auth/loginbyapikey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `apikey=${key}`,
    });
    if (auth.status !== 200) return result('ShATE-M', false, `auth HTTP ${auth.status}: ${(await auth.text()).slice(0, 150)}`);
    const { access_token } = await auth.json();

    // 2. Поиск артикула
    const search = await fetch(
      `https://api.shate-m.ru/api/v1/articles/search/${encodeURIComponent(TEST_ARTICLE)}?include=trademark&TradeMarkNames=${encodeURIComponent(TEST_BRAND)}`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    if (search.status !== 200) return result('ShATE-M', false, `search HTTP ${search.status}`);
    const articles = await search.json();
    const list = Array.isArray(articles) ? articles : articles ? [articles] : [];
    const articleId = list[0]?.article?.id;
    if (!articleId) return result('ShATE-M', true, `авторизация OK, но артикул ${TEST_ARTICLE} ${TEST_BRAND} не найден`);

    // 3. Детали — есть ли картинки?
    const det = await fetch(
      `https://api.shate-m.ru/api/v1/articles/${articleId}?include=extended_info`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    const detData = await det.json();
    const detTxt = JSON.stringify(detData);
    const imgMatch = detTxt.match(/"(images|pictures|imageUrls|imageUrl|picture)"\s*:\s*[^,}]+/i);
    result('ShATE-M', true, `OK, articleId=${articleId}, картинки в /articles/{id}: ${imgMatch ? `ДА (${imgMatch[1]})` : 'нет полей с image*'}`);
  } catch (e) {
    result('ShATE-M', false, e.message);
  }
}

// ────────────────────────────────────────────
async function checkForumAuto() {
  const login = process.env.FORUM_AUTO_LOGIN;
  const pass = process.env.FORUM_AUTO_PASSWORD;
  if (!login || !pass) return result('Forum-Auto', false, 'нет логина/пароля');
  try {
    const url = `https://api.forum-auto.ru/v2/searchOffers?login=${encodeURIComponent(login)}&password=${encodeURIComponent(pass)}&code=${encodeURIComponent(TEST_ARTICLE)}&brand=${encodeURIComponent(TEST_BRAND)}&cross=0`;
    const r = await fetch(url);
    const txt = await r.text();
    if (r.status === 200) {
      try {
        const data = JSON.parse(txt);
        const count = Array.isArray(data) ? data.length : (data.offers?.length || 0);
        const hasImg = txt.match(/picture|image|photo/i);
        result('Forum-Auto', true, `OK, офферов: ${count}, картинка в ответе: ${hasImg ? `ДА (${hasImg[0]})` : 'нет'}`);
      } catch {
        result('Forum-Auto', false, `не-JSON ответ: ${txt.slice(0, 150)}`);
      }
    } else {
      result('Forum-Auto', false, `HTTP ${r.status}: ${txt.slice(0, 150)}`);
    }
  } catch (e) {
    result('Forum-Auto', false, e.message);
  }
}

// ────────────────────────────────────────────
async function checkArmtek() {
  const login = process.env.ARMTEK_LOGIN;
  const pass = process.env.ARMTEK_PASSWORD;
  const vkorg = process.env.ARMTEK_VKORG || '4000';
  const kunnr = process.env.ARMTEK_KUNNR_RG;
  if (!login || !pass) return result('Armtek', false, 'нет логина/пароля');
  try {
    const auth = 'Basic ' + Buffer.from(`${login}:${pass}`).toString('base64');
    const url = `http://ws.armtek.ru/api/search/search?VKORG=${vkorg}&KUNNR_RG=${kunnr}&PIN=${encodeURIComponent(TEST_ARTICLE)}&BRAND=${encodeURIComponent(TEST_BRAND)}&QUERY_TYPE=1&format=json`;
    const r = await fetch(url, { headers: { Authorization: auth } });
    const txt = await r.text();
    if (r.status === 200) {
      try {
        const data = JSON.parse(txt);
        const items = data.RESP || data.response || [];
        const count = Array.isArray(items) ? items.length : 0;
        const hasImg = txt.match(/IMG_LARGE|IMG_SMALL|picture|image|photo/i);
        result('Armtek', true, `OK, ${data.STATUS || ''} позиций: ${count}, картинка: ${hasImg ? `ДА (${hasImg[0]})` : 'нет'}`);
      } catch {
        result('Armtek', false, `не-JSON: ${txt.slice(0, 150)}`);
      }
    } else {
      result('Armtek', false, `HTTP ${r.status}: ${txt.slice(0, 150)}`);
    }
  } catch (e) {
    result('Armtek', false, e.message);
  }
}

// ────────────────────────────────────────────
console.log(`\nТестовый артикул: ${TEST_BRAND} ${TEST_ARTICLE}\n`);
await Promise.all([
  checkBerg(),
  checkRossko(),
  checkShateM(),
  checkForumAuto(),
  checkArmtek(),
]);
console.log('');
