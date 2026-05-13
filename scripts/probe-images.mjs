// Глубокая проверка: какие endpoints у поставщиков возвращают КАРТИНКИ
// Запуск: node scripts/probe-images.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const OUT = resolve(process.cwd(), 'scripts', 'probe-output');
try { mkdirSync(OUT, { recursive: true }); } catch {}

const TEST_ARTICLE = '0242235666';
const TEST_BRAND = 'Bosch';

const findImageKeys = (obj, path = '', acc = []) => {
  if (!obj || typeof obj !== 'object') return acc;
  for (const [k, v] of Object.entries(obj)) {
    const p = path ? `${path}.${k}` : k;
    if (/image|picture|photo|img|preview|thumb/i.test(k)) {
      const sample = typeof v === 'string' ? v.slice(0, 100) : Array.isArray(v) ? `[${v.length} items] ${JSON.stringify(v[0]).slice(0, 100)}` : JSON.stringify(v).slice(0, 100);
      acc.push(`${p} = ${sample}`);
    }
    if (typeof v === 'object') findImageKeys(v, p, acc);
  }
  return acc;
};

// ── Berg ──────────────────────────────
async function probeBerg() {
  console.log('\n━━━ BERG ━━━');
  const key = process.env.BERG_API_KEY;

  // 1. get_stock — для articleId
  const stockUrl = `https://api.berg.ru/v1.0/ordering/get_stock.json?key=${key}&analogs=0&items[0][resource_article]=${TEST_ARTICLE}&items[0][brand_name]=${TEST_BRAND}`;
  const stockR = await fetch(stockUrl);
  const stockData = await stockR.json();
  const resourceId = stockData.resources?.[0]?.id;
  console.log(`get_stock → resourceId=${resourceId}`);
  writeFileSync(`${OUT}/berg-get_stock.json`, JSON.stringify(stockData, null, 2));

  if (!resourceId) return;

  // 2. Пробуем разные endpoint'ы для инфо о ресурсе
  const endpoints = [
    `/v1.0/ordering/get_resource_info.json?key=${key}&resource_id=${resourceId}`,
    `/v1.0/ordering/get_picture.json?key=${key}&resource_id=${resourceId}`,
    `/v1.0/references/get_brands.json?key=${key}`,
  ];
  for (const ep of endpoints) {
    try {
      const r = await fetch(`https://api.berg.ru${ep}`);
      const txt = await r.text();
      console.log(`  ${ep.split('?')[0]} → HTTP ${r.status} (${txt.length} bytes)`);
      if (r.status === 200) {
        try {
          const data = JSON.parse(txt);
          const imgs = findImageKeys(data);
          if (imgs.length) console.log(`    🖼  поля с картинками:\n    ` + imgs.join('\n    '));
          writeFileSync(`${OUT}/berg-${ep.split('/').pop().split('?')[0]}.json`, JSON.stringify(data, null, 2));
        } catch {
          console.log(`    (не JSON: ${txt.slice(0, 100)})`);
        }
      } else {
        console.log(`    ${txt.slice(0, 150)}`);
      }
    } catch (e) {
      console.log(`    error: ${e.message}`);
    }
  }
}

// ── ShATE-M ──────────────────────────────
async function probeShateM() {
  console.log('\n━━━ SHATE-M ━━━');
  const key = process.env.SHATE_M_API_KEY;
  const auth = await fetch('https://api.shate-m.ru/api/v1/auth/loginbyapikey', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `apikey=${key}`,
  });
  const { access_token } = await auth.json();
  const headers = { Authorization: `Bearer ${access_token}` };

  const search = await fetch(
    `https://api.shate-m.ru/api/v1/articles/search/${TEST_ARTICLE}?include=trademark&TradeMarkNames=${TEST_BRAND}`,
    { headers }
  );
  const arts = await search.json();
  const list = Array.isArray(arts) ? arts : arts ? [arts] : [];
  const articleId = list[0]?.article?.id;
  console.log(`articles/search → articleId=${articleId}`);

  // Пробуем разные include
  const includes = ['extended_info', 'images', 'image', 'files', 'media', 'attachments', 'extended_info,images', 'all'];
  for (const inc of includes) {
    const r = await fetch(`https://api.shate-m.ru/api/v1/articles/${articleId}?include=${inc}`, { headers });
    const txt = await r.text();
    if (r.status === 200) {
      try {
        const data = JSON.parse(txt);
        const imgs = findImageKeys(data);
        const sz = txt.length;
        console.log(`  include=${inc} → 200 (${sz} bytes)${imgs.length ? `, 🖼 ${imgs.length} полей` : ''}`);
        if (imgs.length) console.log(`    ` + imgs.join('\n    '));
        writeFileSync(`${OUT}/shatem-${inc.replace(/,/g, '_')}.json`, JSON.stringify(data, null, 2));
      } catch { console.log(`  include=${inc} → не JSON`); }
    } else {
      console.log(`  include=${inc} → HTTP ${r.status}`);
    }
  }

  // Также: специальные endpoint'ы
  const extraEndpoints = [
    `/api/v1/articles/${articleId}/images`,
    `/api/v1/articles/${articleId}/files`,
    `/api/v1/articles/${articleId}/media`,
  ];
  for (const ep of extraEndpoints) {
    const r = await fetch(`https://api.shate-m.ru${ep}`, { headers });
    console.log(`  ${ep} → HTTP ${r.status}`);
    if (r.status === 200) {
      const txt = await r.text();
      console.log(`    ` + txt.slice(0, 300));
    }
  }
}

// ── Rossko ──────────────────────────────
async function probeRossko() {
  console.log('\n━━━ ROSSKO ━━━');
  const k1 = process.env.ROSSKO_KEY1, k2 = process.env.ROSSKO_KEY2;
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://api.rossko.ru/">
  <soap:Body><tns:GetSearch>
    <KEY1>${k1}</KEY1><KEY2>${k2}</KEY2>
    <text>${TEST_BRAND} ${TEST_ARTICLE}</text>
    <delivery_id>${process.env.ROSSKO_DELIVERY_ID || '000000001'}</delivery_id>
    <address_id>${process.env.ROSSKO_ADDRESS_ID || '270997'}</address_id>
  </tns:GetSearch></soap:Body></soap:Envelope>`;
  const r = await fetch('http://api.rossko.ru/service/v2.1/GetSearch', {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: 'GetSearch' },
    body: envelope,
  });
  const txt = await r.text();
  writeFileSync(`${OUT}/rossko-getsearch.xml`, txt);
  console.log(`GetSearch → HTTP ${r.status} (${txt.length} bytes)`);
  // ищем все теги
  const tags = [...new Set([...txt.matchAll(/<([a-zA-Z_][a-zA-Z0-9_]*)/g)].map(m => m[1]))];
  console.log(`  все теги: ${tags.join(', ')}`);
  const imgTags = tags.filter(t => /pic|img|photo|image/i.test(t));
  console.log(`  🖼  теги-картинки: ${imgTags.length ? imgTags.join(', ') : 'НЕТ'}`);

  // Пробуем GetSearchExt — может, расширенный поиск отдаёт картинки
  for (const method of ['GetSearchExt', 'GetPartInfo', 'GetItemInfo']) {
    const env = envelope.replace(/GetSearch/g, method);
    const rr = await fetch(`http://api.rossko.ru/service/v2.1/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: method },
      body: env,
    });
    const t = await rr.text();
    console.log(`  ${method} → HTTP ${rr.status} (${t.length} bytes) ${t.match(/<faultstring>([^<]+)/)?.[1] || ''}`);
  }
}

// ── Forum-Auto ──────────────────────────────
async function probeForumAuto() {
  console.log('\n━━━ FORUM-AUTO ━━━');
  const login = encodeURIComponent(process.env.FORUM_AUTO_LOGIN);
  const pass = encodeURIComponent(process.env.FORUM_AUTO_PASSWORD);

  const endpoints = [
    `/v2/searchOffers?login=${login}&password=${pass}&code=${TEST_ARTICLE}&brand=${TEST_BRAND}&cross=1`,
    `/v2/searchOffers?login=${login}&password=${pass}&code=${TEST_ARTICLE}&cross=1`,
    `/v2/searchBrandsByCode?login=${login}&password=${pass}&code=${TEST_ARTICLE}`,
    `/v2/getArticleInfo?login=${login}&password=${pass}&code=${TEST_ARTICLE}&brand=${TEST_BRAND}`,
  ];
  for (const ep of endpoints) {
    try {
      const r = await fetch(`https://api.forum-auto.ru${ep}`);
      const txt = await r.text();
      const path = ep.split('?')[0];
      console.log(`  ${path} → HTTP ${r.status} (${txt.length} bytes)`);
      if (r.status === 200) {
        try {
          const data = JSON.parse(txt);
          const imgs = findImageKeys(data);
          if (imgs.length) console.log(`    🖼 ` + imgs.join('\n    🖼 '));
          writeFileSync(`${OUT}/forum-${path.split('/').pop()}.json`, JSON.stringify(data, null, 2));
        } catch {
          console.log(`    не JSON: ${txt.slice(0, 200)}`);
        }
      }
    } catch (e) { console.log(`  error: ${e.message}`); }
  }
}

// ── Armtek ──────────────────────────────
async function probeArmtek() {
  console.log('\n━━━ ARMTEK ━━━');
  const login = process.env.ARMTEK_LOGIN, pass = process.env.ARMTEK_PASSWORD;
  const vkorg = process.env.ARMTEK_VKORG || '4000';
  const kunnr = process.env.ARMTEK_KUNNR_RG;
  const auth = 'Basic ' + Buffer.from(`${login}:${pass}`).toString('base64');

  // Пробуем разные базовые URL и форматы
  const variants = [
    `http://ws.armtek.ru/api/search/search?VKORG=${vkorg}&KUNNR_RG=${kunnr}&PIN=${TEST_ARTICLE}&BRAND=${TEST_BRAND}&QUERY_TYPE=1&format=json`,
    `https://ws.armtek.ru/api/search/search?VKORG=${vkorg}&KUNNR_RG=${kunnr}&PIN=${TEST_ARTICLE}&BRAND=${TEST_BRAND}&QUERY_TYPE=1&format=json`,
    `http://ws.armtek.ru/api/ws_search/search?VKORG=${vkorg}&KUNNR_RG=${kunnr}&PIN=${TEST_ARTICLE}&BRAND=${TEST_BRAND}&format=json`,
    `https://ws.armtek.ru/api/ws_search/search?VKORG=${vkorg}&KUNNR_RG=${kunnr}&PIN=${TEST_ARTICLE}&BRAND=${TEST_BRAND}&format=json`,
  ];
  for (const url of variants) {
    try {
      const r = await fetch(url, { headers: { Authorization: auth, Accept: 'application/json' } });
      const txt = await r.text();
      console.log(`  ${url.replace(/PIN=.*$/, 'PIN=...')} → HTTP ${r.status}`);
      if (r.status === 200) {
        try {
          const data = JSON.parse(txt);
          const imgs = findImageKeys(data);
          console.log(`    STATUS=${data.STATUS}, response items: ${Array.isArray(data.RESP) ? data.RESP.length : '?'}`);
          if (imgs.length) console.log(`    🖼 ` + imgs.join('\n    🖼 '));
          writeFileSync(`${OUT}/armtek-search.json`, JSON.stringify(data, null, 2));
          return;
        } catch {
          console.log(`    не JSON: ${txt.slice(0, 200)}`);
        }
      } else {
        console.log(`    ${txt.slice(0, 200).replace(/\n/g, ' ')}`);
      }
    } catch (e) {
      console.log(`  error: ${e.message}`);
    }
  }
}

await probeBerg().catch(e => console.log('Berg failed:', e.message));
await probeShateM().catch(e => console.log('ShATE-M failed:', e.message));
await probeRossko().catch(e => console.log('Rossko failed:', e.message));
await probeForumAuto().catch(e => console.log('Forum-Auto failed:', e.message));
await probeArmtek().catch(e => console.log('Armtek failed:', e.message));
console.log(`\nСырые ответы сохранены в ${OUT}\n`);
