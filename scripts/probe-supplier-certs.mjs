#!/usr/bin/env node
/**
 * Проверка: отдают ли API поставщиков ссылки на сертификаты/декларации
 * соответствия (546-ФЗ, с 01.09.2026 ссылка на запись в реестре обязательна
 * в карточке при дистанционной продаже).
 *
 * Делает по одному живому запросу к каждому поставщику по заданному артикулу
 * и печатает: HTTP-статус, ключи позиции в ответе и поля, похожие на
 * сертификат/декларацию/документ. Ничего не пишет в БД.
 *
 * Ключи берёт из переменных окружения (те же, что у сайта).
 *
 * Локально:   node --env-file=.env.local scripts/probe-supplier-certs.mjs GDB1550 TRW
 * На проде:   docker cp scripts/probe-supplier-certs.mjs brocar-app:/app/scripts/ &&
 *             docker exec brocar-app node /app/scripts/probe-supplier-certs.mjs GDB1550 TRW
 * (ShATE-M, Forum-Auto и PartKom пускают только с IP сервера — локально
 *  они дадут 403/таймаут, это нормально.)
 */
const ARTICLE = process.argv[2] || "GDB1550";
const BRAND = process.argv[3] || "TRW";
const T = 15000;
const env = process.env;

const CERT_SRC = /"?([A-Za-z_\-]*(cert|серт|declar|деклар|document|докум|fsa|росаккред)[A-Za-z_\-]*)"?\s*[:=>]/i;

function certFields(text) {
  const re = new RegExp(CERT_SRC.source, "gi");
  const found = new Set();
  let m;
  while ((m = re.exec(text))) found.add(m[1]);
  return [...found];
}
function keysOf(obj) {
  if (!obj || typeof obj !== "object") return [];
  if (Array.isArray(obj)) return keysOf(obj[0]);
  return Object.keys(obj);
}
function report(label, text) {
  const f = certFields(text);
  console.log(`  поля про сертификаты (${label}):`, f.length ? f.join(", ") : "НЕТ");
  // Примеры значений — чтобы видеть, куда ведёт ссылка (реестр ФСА? сайт поставщика?).
  for (const name of f) {
    const re = new RegExp(`"${name}"\\s*:\\s*("(?:[^"\\\\]|\\\\.)*"|[^,}\\]]+)`, "g");
    const vals = new Set();
    let m;
    while ((m = re.exec(text)) && vals.size < 3) vals.add(m[1].slice(0, 200));
    if (vals.size) console.log(`    ${name} =`, [...vals].join(" | "));
  }
}
function tryJson(t) {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}
async function run(name, fn) {
  console.log(`\n### ${name}`);
  try {
    await fn();
  } catch (e) {
    console.log("  ОШИБКА:", (e && (e.cause?.message || e.message)) || e);
  }
}

console.log(`Артикул: ${ARTICLE} | Бренд: ${BRAND}`);

// ── Berg (REST get_stock) ─────────────────────────────────────
await run("Berg", async () => {
  if (!env.BERG_API_KEY) return console.log("  нет BERG_API_KEY");
  const base = env.BERG_API_URL || "https://api.berg.ru";
  const url = `${base}/v1.0/ordering/get_stock.json?key=${env.BERG_API_KEY}&analogs=0&items[0][resource_article]=${encodeURIComponent(ARTICLE)}&items[0][brand_name]=${encodeURIComponent(BRAND)}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(T) });
  const t = await r.text();
  const j = tryJson(t) || {};
  const res0 = (j.resources || [])[0];
  console.log("  HTTP", r.status, "| resources:", (j.resources || []).length, "| ключи resource:", keysOf(res0).join(", "), "| ключи offer:", keysOf(res0?.offers).join(", "));
  report("get_stock", t);
});

// ── Rossko (SOAP GetSearch) ───────────────────────────────────
await run("Rossko", async () => {
  if (!env.ROSSKO_KEY1 || !env.ROSSKO_KEY2) return console.log("  нет ROSSKO_KEY1/KEY2");
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const base = (env.ROSSKO_API_URL || "https://api.rossko.ru/service/v2.1").replace(/^http:\/\//, "https://");
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:api="https://api.rossko.ru/">
  <soapenv:Body><api:GetSearch>
    <KEY1>${esc(env.ROSSKO_KEY1)}</KEY1><KEY2>${esc(env.ROSSKO_KEY2)}</KEY2>
    <text>${esc(BRAND + " " + ARTICLE)}</text>
    <delivery_id>${esc(env.ROSSKO_DELIVERY_ID || "000000001")}</delivery_id>
    <address_id>${esc(env.ROSSKO_ADDRESS_ID || "270997")}</address_id>
  </api:GetSearch></soapenv:Body></soapenv:Envelope>`;
  const r = await fetch(`${base}/GetSearch`, {
    method: "POST",
    body,
    headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: '"https://api.rossko.ru/GetSearch"' },
    signal: AbortSignal.timeout(T),
  });
  const xml = await r.text();
  const tags = [...new Set([...xml.matchAll(/<ns1:([A-Za-z_]+)>/g)].map((m) => m[1]))];
  console.log("  HTTP", r.status, "| теги ответа:", tags.join(", "));
  report("GetSearch", xml);
});

// ── ShATE-M (REST) ────────────────────────────────────────────
await run("ShATE-M", async () => {
  if (!env.SHATE_M_API_KEY) return console.log("  нет SHATE_M_API_KEY");
  const base = env.SHATE_M_API_URL || "https://api.shate-m.ru";
  const tr = await fetch(`${base}/api/v1/auth/loginbyapikey`, {
    method: "POST",
    body: new URLSearchParams({ apikey: env.SHATE_M_API_KEY }),
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    signal: AbortSignal.timeout(T),
  });
  const tt = await tr.text();
  const tok = tryJson(tt);
  if (!tok?.access_token) return console.log("  auth HTTP", tr.status, "|", tt.replace(/\s+/g, " ").slice(0, 160));
  const H = { Authorization: `Bearer ${tok.access_token}`, Accept: "application/json" };
  const sr = await fetch(`${base}/api/v1/articles/search/${encodeURIComponent(ARTICLE)}?include=trademark&TradeMarkNames=${encodeURIComponent(BRAND)}`, { headers: H, signal: AbortSignal.timeout(T) });
  const st = await sr.text();
  const s = tryJson(st);
  const arts = Array.isArray(s) ? s : s ? [s] : [];
  console.log("  articles/search: HTTP", sr.status, "| найдено", arts.length, "| article.keys:", keysOf(arts[0]?.article).join(", "));
  report("search", st);
  const id = arts[0]?.article?.id;
  if (!id) return;
  const ir = await fetch(`${base}/api/v1/articles/${id}?include=trademark,documents,properties,images,certificates`, { headers: H, signal: AbortSignal.timeout(T) });
  const it = await ir.text();
  console.log(`  articles/${id}: HTTP ${ir.status} | ключи:`, keysOf(tryJson(it)).join(", "));
  report("article info", it);
  const pr = await fetch(`${base}/api/v1/prices/search/with_article_info`, {
    method: "POST",
    headers: { ...H, "Content-Type": "application/json" },
    body: JSON.stringify([{ articleId: id, agreementCode: env.SHATE_M_AGREEMENT_CODE, deliveryAddressCode: env.SHATE_M_DELIVERY_ADDRESS_CODE, includeAnalogs: false }]),
    signal: AbortSignal.timeout(T),
  });
  const pt = await pr.text();
  console.log("  prices/with_article_info: HTTP", pr.status, "| ключи:", keysOf(tryJson(pt)).join(", "));
  report("prices", pt);
});

// ── Armtek (REST ws_search) ───────────────────────────────────
await run("Armtek", async () => {
  if (!env.ARMTEK_LOGIN || !env.ARMTEK_PASSWORD) return console.log("  нет ARMTEK_LOGIN/PASSWORD");
  const base = env.ARMTEK_API_URL || "http://ws.armtek.ru/api";
  const body = new URLSearchParams({ VKORG: env.ARMTEK_VKORG || "4000", KUNNR_RG: env.ARMTEK_KUNNR_RG || "", PIN: ARTICLE, BRAND, QUERY_TYPE: "1" }).toString();
  const auth = Buffer.from(`${env.ARMTEK_LOGIN}:${env.ARMTEK_PASSWORD}`).toString("base64");
  const r = await fetch(`${base}/ws_search/search?format=json`, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${auth}`, Accept: "application/json" },
    signal: AbortSignal.timeout(T),
  });
  const t = await r.text();
  const items = tryJson(t)?.RESP || [];
  console.log("  HTTP", r.status, "| позиций", Array.isArray(items) ? items.length : "?", "| ключи позиции:", keysOf(items).join(", "));
  report("ws_search", t);
});

// ── Forum-Auto (REST listGoods) ───────────────────────────────
await run("Forum-Auto", async () => {
  if (!env.FORUM_AUTO_LOGIN || !env.FORUM_AUTO_PASSWORD) return console.log("  нет FORUM_AUTO_LOGIN/PASSWORD");
  const base = env.FORUM_AUTO_API_URL || "https://api.forum-auto.ru";
  const u = new URL(`${base}/v2/listGoods`);
  u.search = new URLSearchParams({ login: env.FORUM_AUTO_LOGIN, pass: env.FORUM_AUTO_PASSWORD, art: ARTICLE, br: BRAND, cross: env.FORUM_AUTO_CROSS || "0" }).toString();
  const r = await fetch(u, { signal: AbortSignal.timeout(T) });
  const t = await r.text();
  const j = tryJson(t);
  console.log("  HTTP", r.status, "| позиций", Array.isArray(j) ? j.length : t.replace(/\s+/g, " ").slice(0, 120), "| ключи позиции:", keysOf(j).join(", "));
  report("listGoods", t);
});

// ── Autotrade (JSON-RPC-подобный) ─────────────────────────────
await run("Autotrade", async () => {
  if (!env.AUTOTRADE_API_KEY) return console.log("  нет AUTOTRADE_API_KEY");
  const base = env.AUTOTRADE_API_URL || "https://api2.autotrade.su/?json";
  const call = async (method, params) => {
    const payload = JSON.stringify({ auth_key: env.AUTOTRADE_API_KEY, method, params });
    const r = await fetch(base, {
      method: "POST",
      body: new URLSearchParams({ data: payload }).toString(),
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", Accept: "application/json" },
      signal: AbortSignal.timeout(T),
    });
    return { status: r.status, text: await r.text() };
  };
  // 1) поиск пар артикул+бренд — вдруг бренд у них записан иначе
  const q = await call("getItemsByQuery", { q: [ARTICLE], strict: 1, replace: 0, cross: 0, related: 0, component: 0, limit: 20 });
  const qj = tryJson(q.text) || {};
  const qItems = Array.isArray(qj.items) ? qj.items : [];
  console.log("  getItemsByQuery: HTTP", q.status, "| найдено", qItems.length, "| ключи товара:", keysOf(qItems).join(", "), qj.message ? `| ${qj.message}` : "");
  report("getItemsByQuery", q.text);
  // 2) цены/остатки по паре (бренд — как записан у Автотрейда)
  const first = qItems[0];
  const brand = first?.brand_name ?? BRAND;
  const article = first?.article ?? ARTICLE;
  const s = await call("getStocksAndPrices", { storages: [0], items: { [article]: { [brand]: 1 } }, withDelivery: 1 });
  const sj = tryJson(s.text) || {};
  const it = sj.items?.[article]?.[brand] ?? sj.items?.[article] ?? sj;
  console.log(`  getStocksAndPrices(${article}/${brand}): HTTP`, s.status, "| верхние ключи:", Object.keys(sj).join(", "), "| ключи товара:", keysOf(it).join(", "), sj.message ? `| ${sj.message}` : "");
  report("getStocksAndPrices", s.text);
});

// ── PartKom (REST search/offers) ──────────────────────────────
await run("PartKom", async () => {
  if (!env.PARTKOM_LOGIN || !env.PARTKOM_PASSWORD) return console.log("  нет PARTKOM_LOGIN/PASSWORD");
  const base = env.PARTKOM_API_URL || "https://ws.part-kom.ru";
  const u = new URL(`${base}/v4/search/offers`);
  u.search = new URLSearchParams({ number: ARTICLE, find_substitutes: "0", store: env.PARTKOM_STORE_ONLY || "0" }).toString();
  const auth = Buffer.from(`${env.PARTKOM_LOGIN}:${env.PARTKOM_PASSWORD}`).toString("base64");
  const r = await fetch(u, { headers: { Authorization: `Basic ${auth}`, Accept: "application/json" }, signal: AbortSignal.timeout(T) });
  const t = await r.text();
  const j = tryJson(t);
  console.log("  HTTP", r.status, "| позиций", Array.isArray(j) ? j.length : t.replace(/\s+/g, " ").slice(0, 120), "| ключи позиции:", keysOf(j).join(", "));
  report("search/offers", t);
});

console.log("\nГотово. «НЕТ» = в ответе нет полей про сертификаты/декларации.");
