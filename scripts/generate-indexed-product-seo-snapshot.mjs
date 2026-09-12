import fs from "node:fs/promises";
import ExcelJS from "exceljs";

const sourcePath = process.argv[2];
const outputPath =
  process.argv[3] || "data/seo-indexed-product-snapshot.json";

if (!sourcePath) {
  throw new Error(
    "Usage: node scripts/generate-indexed-product-seo-snapshot.mjs <webmaster.xlsx> [output.json]"
  );
}

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(sourcePath);
const sheet = workbook.worksheets[0];
if (!sheet) throw new Error("The workbook has no worksheets");

const headers = new Map();
sheet.getRow(1).eachCell((cell, column) => {
  headers.set(String(cell.value || "").trim(), column);
});

const value = (row, key) => String(row.getCell(headers.get(key)).text || "").trim();
const latestByUrl = new Map();
for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
  const row = sheet.getRow(rowNumber);
  const url = value(row, "url");
  if (url && !latestByUrl.has(url)) latestByUrl.set(url, row);
}

const products = [...latestByUrl.entries()]
  .filter(
    ([url, row]) =>
      url.includes("/product/") &&
      value(row, "event").toUpperCase() === "ADD" &&
      value(row, "status").toUpperCase() === "SEARCHABLE"
  )
  .map(([url, row]) => ({ url, indexedTitle: value(row, "title") }));

const curatedKey = (article, brand) =>
  `${String(article).toLocaleLowerCase("ru-RU").replace(/[^a-zа-яё0-9]/gi, "")}|${String(
    brand
  )
    .toLocaleLowerCase("ru-RU")
    .replace(/[^a-zа-яё0-9]/gi, "")}`;

// Названия для индексных карточек, по которым текущие поставщики уже не отдают
// точный товар, а старый Title Яндекса содержит только заглушку. Каждый артикул
// проверен отдельно по открытому OEM-каталогу; ссылка хранится вместе со снимком.
const curatedNames = new Map(
  [
    ["1930055", "CGA", "Замок крышки багажника", "https://www.detaluga.ru/catalog/27685435"],
    ["2560002566", "AUTOKAT", "Термостат", "https://mkena.com/en/product/filter/2560002566"],
    ["31102804010", "ГАЗ", "Бампер задний ГАЗ-3110", "https://vamzapchast.ru/catalog/tehnoplast/31102804010"],
    ["4112QE", "Peugeot/Citroen", "Болт крепления рулевого колеса", "https://partsouq.com/en/catalog/genuine/unit?c=PEUGEOT00&cid=58"],
    ["4504609800", "Toyota/Lexus", "Наконечник рулевой тяги правый", "https://www.megazip.net/zapchasti-dlya/toyota/end-sub-assy-tie-rod-rh-4504609800"],
    ["4851060260", "Toyota/Lexus", "Амортизатор передний", "https://www.partsnext.com/toyota/48510-60260-absorber-assy-shock-front-rh-lh/"],
    ["5535026200", "Hyundai/Kia/Mobis", "Пружина задняя", "https://partsouq.com/en/catalog/genuine/parts?c=HYUNDAI&gid=480"],
    ["650172", "General Motors", "Фильтр масляный", "https://brocarparts.ru/product/650172?brand=Opel%2FChevrolet%2FGM"],
    ["LR041978", "LAND ROVER/JAGUAR", "Фильтр топливный", "https://parts.jaguarlandroverclassic.com/lr041978-filter-fuel.html"],
    ["S5530526200", "Hyundai/Kia/Mobis", "Амортизатор задний", "https://partsouq.com/en/catalog/genuine/parts?c=HYUNDAI&gid=480"],
  ].map(([article, brand, name, evidenceUrl]) => [
    curatedKey(article, brand),
    { name, evidenceUrl },
  ])
);

const decodeHtml = (text) =>
  text
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();

const capture = (html, expression) => {
  const match = html.match(expression);
  return match ? decodeHtml(match[1] || "") : "";
};

const isWeakShellName = (name) =>
  !name ||
  /^Запчасть(?:\s|$)/i.test(name) ||
  /Неизвестный бренд/i.test(name) ||
  /автозапчасть для автомобиля/i.test(name) ||
  /[\\�]/.test(name) ||
  /[!?](?:\s|$)/.test(name) ||
  /(?:^|\s)[А-Я](?:\s[А-Я]){2,}(?:\s|$)/.test(name) ||
  name.length > 160;

const isUsableLiveName = (name) => {
  if (!name || name.length > 220) return false;
  if (/[\\�\u0000-\u001f\u007f]/.test(name)) return false;
  return (name.match(/[A-Za-zА-Яа-яЁёÀ-ÖØ-öø-ÿ]/g) || []).length >= 3;
};

if (process.argv.includes("--show-failure-titles")) {
  const current = JSON.parse(await fs.readFile(outputPath, "utf8"));
  const failureUrls = new Set(current.failures.map((item) => item.url));
  console.log(
    JSON.stringify(
      products.filter((item) => failureUrls.has(item.url)),
      null,
      2
    )
  );
  process.exit(0);
}

if (process.argv.includes("--backfill-indexed-titles")) {
  const current = JSON.parse(await fs.readFile(outputPath, "utf8"));
  const productByUrl = new Map(products.map((item) => [item.url, item]));
  const recovered = [];
  const remaining = [];

  for (const failure of current.failures) {
    const product = productByUrl.get(failure.url);
    const url = new URL(failure.url);
    const article = decodeURIComponent(url.pathname.split("/product/")[1] || "");
    const requestedBrand = url.searchParams.get("brand") || "";
    const curated = curatedNames.get(curatedKey(article, requestedBrand));
    const parts = String(product?.indexedTitle || "").split(" — ");
    const candidate = String(curated?.name || parts[1] || "")
      .replace(/\s+—\s+купить[\s\S]*$/i, "")
      .replace(/\s*\|\s*BroCar\s*$/i, "")
      .replace(/\s+подходит для\s+[\s\S]*$/i, "")
      .replace(/\\[\s\S]*$/, "")
      .replace(/!+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    const identity = (text) =>
      String(text || "").toLocaleLowerCase("ru-RU").replace(/[^a-zа-яё0-9]/gi, "");

    if (
      isUsableLiveName(candidate) &&
      identity(candidate) !== identity(article) &&
      !/^Запчасть(?:\s|$)/i.test(candidate)
    ) {
      recovered.push({
        article,
        requestedBrand,
        brand: requestedBrand,
        name: candidate,
        minPrice: null,
        sourceUrl: failure.url,
        ...(curated?.evidenceUrl
          ? { evidenceUrl: curated.evidenceUrl }
          : {}),
      });
    } else {
      remaining.push(failure);
    }
  }

  current.generatedAt = new Date().toISOString();
  current.products.push(...recovered);
  current.failures = remaining;
  await fs.writeFile(outputPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  console.log(`Recovered ${recovered.length}; remaining ${remaining.length}`);
  process.exit(0);
}

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "Mozilla/5.0 BroCar-SEO-snapshot/1.0" },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

const retryFailures = process.argv.includes("--retry-failures");
let previousSnapshot = null;
const weak = [];

if (retryFailures) {
  previousSnapshot = JSON.parse(await fs.readFile(outputPath, "utf8"));
  weak.push(...previousSnapshot.failures);
  console.log(`Retrying ${weak.length} previous failures`);
} else {
  let inspected = 0;
  const pageQueue = [...products];
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (pageQueue.length) {
        const item = pageQueue.shift();
        if (!item) break;
        try {
          const html = await fetchText(item.url);
          const h1 = capture(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
          if (isWeakShellName(h1)) weak.push({ ...item, h1 });
        } catch (error) {
          weak.push({ ...item, h1: "", pageError: String(error) });
        }
        inspected += 1;
        if (inspected % 25 === 0 || inspected === products.length) {
          console.log(`HTML ${inspected}/${products.length}, weak ${weak.length}`);
        }
      }
    })
  );
}

weak.sort((a, b) => a.url.localeCompare(b.url));
const entries = [...(previousSnapshot?.products ?? [])];
const failures = [];

for (let index = 0; index < weak.length; index += 1) {
  const item = weak[index];
  const url = new URL(item.url);
  const article = decodeURIComponent(url.pathname.split("/product/")[1] || "");
  const requestedBrand = url.searchParams.get("brand") || "";
  const apiUrl = new URL(`/api/product/${encodeURIComponent(article)}`, url.origin);
  if (requestedBrand) apiUrl.searchParams.set("brand", requestedBrand);

  try {
    const response = await fetch(apiUrl, {
      headers: { "user-agent": "Mozilla/5.0 BroCar-SEO-snapshot/1.0" },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const data = await response.json();
    const group = data?.group;
    if (!group || !isUsableLiveName(group.name)) {
      throw new Error("No usable exact product group");
    }

    entries.push({
      article: String(group.article || article),
      requestedBrand,
      brand: String(group.brand || requestedBrand),
      name: String(group.name),
      minPrice:
        Number.isFinite(Number(group.minPrice)) && Number(group.minPrice) > 0
          ? Number(group.minPrice)
          : null,
      sourceUrl: item.url,
    });
  } catch (error) {
    failures.push({ url: item.url, h1: item.h1, error: String(error) });
  }

  console.log(
    `API ${index + 1}/${weak.length}, saved ${entries.length}, failed ${failures.length}`
  );
  await new Promise((resolve) => setTimeout(resolve, 400));
}

const snapshot = {
  generatedAt: new Date().toISOString(),
  source: "Yandex Webmaster indexed-pages export",
  indexedProducts: previousSnapshot?.indexedProducts ?? products.length,
  weakShellProducts: previousSnapshot?.weakShellProducts ?? weak.length,
  products: entries,
  failures,
};

await fs.writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(
  `DONE indexed=${products.length} weak=${weak.length} saved=${entries.length} failed=${failures.length}`
);
