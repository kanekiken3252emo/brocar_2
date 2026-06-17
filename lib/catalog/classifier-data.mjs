/**
 * Единый источник правил классификации товаров по наименованию.
 *
 * Чистый ESM (.mjs) без TypeScript — чтобы один и тот же код использовали:
 *   • рантайм Next.js  → через обёртку lib/catalog/classifier.ts (с типами);
 *   • скрипт импорта   → scripts/import-berg-csv.mjs (прямой импорт).
 *
 * Раньше эти правила были СКОПИРОВАНЫ в обоих местах и разъезжались
 * (в импортёре не хватало брендов и всех exclude). Теперь — одна копия.
 *
 * При добавлении новой категории — также добавить её в CATEGORY_META,
 * чтобы в меню появился нормальный title.
 */

/**
 * Порядок важен: первая совпавшая категория выигрывает.
 * Специфичные правила должны идти ДО общих.
 *
 * Поле `exclude` — стоп-слова: если совпал keyword, но в наименовании есть
 * любое из exclude, категория НЕ присваивается и проверка идёт дальше по
 * списку. Нужно для арматуры, которая содержит ключевое слово, но искомой
 * деталью не является («патрон лампы», «предохранительный клапан»,
 * «гайковёрт аккумуляторный», «рейка без датчика»).
 *
 * @typedef {{ slug: string, keywords: string[], exclude?: string[] }} CategoryPattern
 * @type {CategoryPattern[]}
 */
/**
 * Слова-признаки ЗАПЧАСТЕЙ, а не жидкости. Жидкостные категории матчатся по
 * одиночным ключам (антифриз/тосол/atf/незамерз/…), которые сидят и в названиях
 * деталей: «Пробка антифриза», «Датчик уровня тосола», «Крышка фильтра ATF»,
 * «Термостат, охлаждающая жидкость». Если в названии есть любое из этих слов —
 * категория жидкости НЕ присваивается, товар уходит дальше по списку (термостат →
 * thermostats, датчик → sensors, патрубок → hoses, прочее → misc).
 * В реальных названиях самих жидкостей этих слов не бывает.
 */
const FLUID_PART_EXCLUDE = [
  "пробка", "заглушк", "датчик", "бачок", "бачк", "крышк", "горловина",
  "патрубок", "шланг", "насос", "помпа", "термостат", "форсунк", "клапан",
  "трубка", "радиатор", "хомут", "штуцер", "фитинг", "колпачок", "прокладк",
  "тройник", "сальник", "корпус", "кронштейн", "держател", "ремкомплект",
  "фильтр", "крыльчатк", "маховик", "шкив",
  // Инструмент/приборы, не жидкость
  "ареометр", "воронка", "щуп", "тестер", "заправочн",
];

export const PATTERNS = [
  // Моторное масло — проверяем до общего "масло", чтобы не конфликтовало с трансмиссионным
  { slug: "engine-oils", keywords: ["масло моторное", "моторное масло", "5w-30", "5w-40", "0w-20", "0w-30", "10w-40", "10w-60"], exclude: FLUID_PART_EXCLUDE },
  { slug: "transmission-oils", keywords: ["масло трансмисс", "трансмиссионное масло", "atf ", "dexron", "gl-4", "gl-5", "75w", "80w"], exclude: FLUID_PART_EXCLUDE },
  { slug: "industrial-oils", keywords: ["масло гидравлическ", "гидравлическое масло", "компрессорное", "для цепей", "цепное масло"], exclude: FLUID_PART_EXCLUDE },
  // Тормоза
  { slug: "brake-pads", keywords: ["колодки тормозн", "тормозные колодки"] },
  { slug: "brake-discs", keywords: ["диск тормозн", "тормозной диск"] },
  { slug: "brake-fluids", keywords: ["жидкость тормозн", "тормозная жидкость", "brake fluid", "dot 3", "dot-3", "dot 4", "dot-4", "dot 5", "dot-5"], exclude: FLUID_PART_EXCLUDE },
  { slug: "brake-hoses", keywords: ["шланг тормозн", "тормозной шланг"] },
  // Охлаждение
  { slug: "coolants", keywords: ["антифриз", "тосол", "coolant", "охлаждающая жидкост", "жидкость охлаждающ"], exclude: FLUID_PART_EXCLUDE },
  { slug: "thermostats", keywords: ["термостат"] },
  { slug: "radiators", keywords: ["радиатор охлажд", "радиатор системы охлажд"] },
  { slug: "water-pumps", keywords: ["насос водян", "помпа"] },
  // Фильтры
  { slug: "oil-filters", keywords: ["фильтр масляный", "масляный фильтр"] },
  { slug: "air-filters", keywords: ["фильтр воздушный", "воздушный фильтр"] },
  { slug: "fuel-filters", keywords: ["фильтр топливный", "топливный фильтр"] },
  { slug: "cabin-filters", keywords: ["фильтр салонный", "салонный фильтр"] },
  // Зажигание
  { slug: "spark-plugs", keywords: ["свеча зажигания", "свечи зажигания", "spark plug"] },
  { slug: "glow-plugs", keywords: ["свеча накаливания", "свечи накаливания"] },
  { slug: "ignition-coils", keywords: ["катушка зажигания"] },
  { slug: "ignition-wires", keywords: ["провод высоков", "провод зажиг"] },
  // Электрика
  {
    // Только стем «ламп». Голые цоколи-коды (h1/h4/hb4/…) как подстрока ловят
    // артикулы (KHB4451STD) и модели авто (Hyundai H1), а «галоген»/«ксенон»/
    // «светодиод» — фары и радары. Реальные лампы всегда содержат «Лампа».
    slug: "lamps",
    keywords: ["ламп"],
    // Светотехническая арматура — не лампы: фары, блоки розжига, патроны
    // (цоколи), держатели, обманки.
    exclude: ["фара", "фары", "фонар", "патрон", "цокол", "держател", "блок розжиг", "блок ксенон", "блок управлен", "обманк", "рассеиват", "кронштейн"],
  },
  {
    slug: "batteries",
    keywords: ["аккумулятор", "акб ", " аккум", "battery"],
    // Не АКБ: гидро-/энергоаккумулятор, аккумуляторный электроинструмент,
    // повербанки/бустеры.
    exclude: ["гидроаккум", "энергоаккум", "гайковерт", "шуруповерт", "дрель", "перфоратор", "фонар", "повербанк", "booster", "внешний универсальн"],
  },
  // «Предохранительный клапан» — деталь гидравлики, а не электрика.
  { slug: "fuses", keywords: ["предохранитель"], exclude: ["клапан"] },
  { slug: "alternators", keywords: ["генератор"] },
  { slug: "starters", keywords: ["стартер"] },
  { slug: "oxygen-sensors", keywords: ["лямбда-зонд", "лямбда зонд", "датчик кислород"] },
  // «без датчика» — деталь, у которой датчика как раз НЕТ (рейки, бачки).
  // «ступица»/«подшипник» отдаём в bearings (он ниже по списку).
  { slug: "sensors", keywords: ["датчик"], exclude: ["без датчик", "ступиц", "подшипник", "бачок"] },
  // Подвеска / ходовая
  { slug: "shock-absorbers", keywords: ["амортизатор"] },
  { slug: "struts", keywords: ["стойка амортизатор", "опора амортизатор"] },
  { slug: "stabilizer-links", keywords: ["стойка стабилизатор", "тяга стабилизатор"] },
  { slug: "ball-joints", keywords: ["шаровая опора", "шаровой шарнир"] },
  { slug: "tie-rods", keywords: ["наконечник рулевой", "тяга рулевая"] },
  { slug: "cv-joints", keywords: ["шрус", "граната рулевая"] },
  { slug: "silent-blocks", keywords: ["сайлентблок", "сайлент-блок"] },
  { slug: "bearings", keywords: ["подшипник"] },
  { slug: "springs", keywords: ["пружина подвески", "пружина передней", "пружина задней"] },
  // Трансмиссия
  { slug: "clutch", keywords: ["сцепление", "диск сцепления", "корзина сцепления", "выжимной"] },
  // ГРМ / двигатель
  { slug: "belts", keywords: ["ремень привод", "ремень грм", "ремень поликлин"] },
  { slug: "chains", keywords: ["цепь грм", "цепь привод"] },
  { slug: "pulleys", keywords: ["ролик натяж", "шкив"] },
  { slug: "engine-mounts", keywords: ["опора двигателя", "подушка двигателя", "опора двс"] },
  { slug: "engine-parts", keywords: ["поршень", "кольца поршнев", "вкладыш", "прокладка гбц", "прокладка головки", "маслосъём"] },
  // Выхлопная
  { slug: "exhaust", keywords: ["глушитель", "резонатор", "катализатор", "гофра"] },
  // Шланги / патрубки
  { slug: "hoses", keywords: ["патрубок", "шланг"] },
  // Щётки
  { slug: "wipers", keywords: ["щетка стеклоочист", "щётка стеклоочист", "щетки стеклоочист", "щётки стеклоочист"] },
  // Омыватель
  { slug: "washer-fluids", keywords: ["жидкость омыват", "жидкость стекло", "незамерз"], exclude: FLUID_PART_EXCLUDE },
  // Автохимия
  {
    slug: "accessories",
    keywords: ["полироль", "шампунь автомоб", "герметик", "очиститель", "размораживатель", "смазка"],
    // «Стеклоочиститель в сборе» (трапеция/мотор) — механика, а не автохимия.
    exclude: ["стеклоочистит"],
  },
  // Кузов
  { slug: "mirrors", keywords: ["зеркало бок", "зеркало зад"] },
  // Радар/фаркоп/ПТФ — не кузовные панели, хоть и содержат «бампер».
  { slug: "body-parts", keywords: ["крыло", "бампер", "капот", "дверь багаж"], exclude: ["радар", "фаркоп", "птф", "фонар"] },
  // Колёса
  { slug: "wheels", keywords: ["диск колесн", "колёсный диск", "колесный диск"] },
];

/**
 * Пользовательские названия категорий для UI. Порядок — порядок показа в меню.
 * @typedef {{ slug: string, title: string, description?: string }} CategoryMeta
 * @type {CategoryMeta[]}
 */
export const CATEGORY_META = [
  { slug: "engine-oils", title: "Масла моторные" },
  { slug: "transmission-oils", title: "Масла трансмиссионные" },
  { slug: "industrial-oils", title: "Масла прочие" },
  { slug: "coolants", title: "Охлаждающие жидкости" },
  { slug: "brake-fluids", title: "Жидкости тормозные" },
  { slug: "washer-fluids", title: "Жидкости для омывателя" },
  { slug: "brake-pads", title: "Колодки тормозные" },
  { slug: "brake-discs", title: "Диски тормозные" },
  { slug: "brake-hoses", title: "Шланги тормозные" },
  { slug: "oil-filters", title: "Фильтры масляные" },
  { slug: "air-filters", title: "Фильтры воздушные" },
  { slug: "fuel-filters", title: "Фильтры топливные" },
  { slug: "cabin-filters", title: "Фильтры салона" },
  { slug: "spark-plugs", title: "Свечи зажигания" },
  { slug: "glow-plugs", title: "Свечи накаливания" },
  { slug: "ignition-coils", title: "Катушки зажигания" },
  { slug: "ignition-wires", title: "Высоковольтные провода" },
  { slug: "lamps", title: "Лампы" },
  { slug: "batteries", title: "Аккумуляторы" },
  { slug: "fuses", title: "Предохранители" },
  { slug: "alternators", title: "Генераторы" },
  { slug: "starters", title: "Стартеры" },
  { slug: "oxygen-sensors", title: "Лямбда-зонды" },
  { slug: "sensors", title: "Датчики" },
  { slug: "shock-absorbers", title: "Амортизаторы" },
  { slug: "struts", title: "Опоры амортизаторов" },
  { slug: "stabilizer-links", title: "Стойки стабилизатора" },
  { slug: "ball-joints", title: "Шаровые опоры" },
  { slug: "tie-rods", title: "Рулевые тяги" },
  { slug: "cv-joints", title: "ШРУСы" },
  { slug: "silent-blocks", title: "Сайлентблоки" },
  { slug: "bearings", title: "Подшипники" },
  { slug: "springs", title: "Пружины подвески" },
  { slug: "clutch", title: "Сцепление" },
  { slug: "belts", title: "Ремни" },
  { slug: "chains", title: "Цепи ГРМ" },
  { slug: "pulleys", title: "Ролики и шкивы" },
  { slug: "engine-mounts", title: "Опоры двигателя" },
  { slug: "engine-parts", title: "Детали двигателя" },
  { slug: "thermostats", title: "Термостаты" },
  { slug: "radiators", title: "Радиаторы" },
  { slug: "water-pumps", title: "Помпы" },
  { slug: "exhaust", title: "Выхлопная система" },
  { slug: "hoses", title: "Патрубки и шланги" },
  { slug: "wipers", title: "Щётки стеклоочистителя" },
  { slug: "accessories", title: "Автохимия и автоаксессуары" },
  { slug: "mirrors", title: "Зеркала" },
  { slug: "body-parts", title: "Детали кузова" },
  { slug: "wheels", title: "Колёсные диски" },
  { slug: "misc", title: "Прочее" },
];

const META_MAP = new Map(CATEGORY_META.map((c) => [c.slug, c]));

/** @param {string} slug */
export function getCategoryMeta(slug) {
  return META_MAP.get(slug);
}

/**
 * Ключи-классы вязкости (5w-30, 75w, 80w, …) опасно матчить подстрокой:
 * «75w» сидит внутри артикулов типа FDB16`75W` и метил тормозные колодки как
 * трансмиссионку. Такие ключи матчим только по ЛЕВОЙ границе слова — перед
 * ними должен быть пробел/символ/начало строки, а не буква/цифра.
 * @param {string} kw  ключ в нижнем регистре
 */
function isViscosityKeyword(kw) {
  return /^\d{1,2}w(-\d{1,3})?$/.test(kw);
}

/** Компилируем каждый ключ в функцию-матчер один раз (вызовов сотни тысяч). */
function compileKeyword(kw) {
  if (isViscosityKeyword(kw)) {
    const re = new RegExp(`(^|[^0-9a-zа-яё])${kw}`);
    return (n) => re.test(n);
  }
  return (n) => n.includes(kw);
}

const COMPILED_PATTERNS = PATTERNS.map((p) => ({
  slug: p.slug,
  match: p.keywords.map(compileKeyword),
  exclude: p.exclude ?? null,
}));

/**
 * Классифицировать товар по наименованию. Возвращает slug категории или 'misc'.
 * @param {string} name
 * @returns {string}
 */
export function detectCategory(name) {
  const n = (name || "").toLowerCase();
  for (const p of COMPILED_PATTERNS) {
    if (!p.match.some((test) => test(n))) continue;
    // Совпало, но это арматура из exclude — пропускаем категорию,
    // деталь матчится дальше по списку (или уходит в misc).
    if (p.exclude && p.exclude.some((ex) => n.includes(ex))) continue;
    return p.slug;
  }
  return "misc";
}

/**
 * Марки авто. Регулярки в ВЕРХНЕМ регистре, match по слову (\b…\b).
 * @typedef {{ slug: string, patterns: RegExp[] }} CarBrandPattern
 * @type {CarBrandPattern[]}
 */
export const CAR_BRANDS = [
  { slug: "BMW", patterns: [/\bBMW\b/] },
  { slug: "AUDI", patterns: [/\bAUDI\b/] },
  { slug: "MERCEDES", patterns: [/\bMERCEDES\b/, /\bBENZ\b/, /\bMB\b/] },
  { slug: "VOLKSWAGEN", patterns: [/\bVOLKSWAGEN\b/, /\bVW\b/] },
  { slug: "SKODA", patterns: [/\bSKODA\b/, /\bШКОДА\b/] },
  { slug: "SEAT", patterns: [/\bSEAT\b/] },
  { slug: "PORSCHE", patterns: [/\bPORSCHE\b/] },
  { slug: "TOYOTA", patterns: [/\bTOYOTA\b/] },
  { slug: "LEXUS", patterns: [/\bLEXUS\b/] },
  { slug: "HONDA", patterns: [/\bHONDA\b/] },
  { slug: "ACURA", patterns: [/\bACURA\b/] },
  { slug: "NISSAN", patterns: [/\bNISSAN\b/] },
  { slug: "INFINITI", patterns: [/\bINFINITI\b/] },
  { slug: "MAZDA", patterns: [/\bMAZDA\b/] },
  { slug: "MITSUBISHI", patterns: [/\bMITSUBISHI\b/] },
  { slug: "SUBARU", patterns: [/\bSUBARU\b/] },
  { slug: "SUZUKI", patterns: [/\bSUZUKI\b/] },
  { slug: "ISUZU", patterns: [/\bISUZU\b/] },
  { slug: "DAIHATSU", patterns: [/\bDAIHATSU\b/] },
  { slug: "SSANGYONG", patterns: [/\bSSANGYONG\b/] },
  { slug: "HYUNDAI", patterns: [/\bHYUNDAI\b/] },
  { slug: "KIA", patterns: [/\bKIA\b/] },
  { slug: "DAEWOO", patterns: [/\bDAEWOO\b/] },
  { slug: "FORD", patterns: [/\bFORD\b/] },
  { slug: "CHEVROLET", patterns: [/\bCHEVROLET\b/, /\bCHEVY\b/] },
  { slug: "OPEL", patterns: [/\bOPEL\b/] },
  { slug: "RENAULT", patterns: [/\bRENAULT\b/] },
  { slug: "PEUGEOT", patterns: [/\bPEUGEOT\b/] },
  { slug: "CITROEN", patterns: [/\bCITROEN\b/] },
  { slug: "DACIA", patterns: [/\bDACIA\b/] },
  { slug: "FIAT", patterns: [/\bFIAT\b/] },
  { slug: "LANCIA", patterns: [/\bLANCIA\b/] },
  { slug: "ALFA-ROMEO", patterns: [/\bALFA\s+ROMEO\b/, /\bALFA-ROMEO\b/] },
  { slug: "VOLVO", patterns: [/\bVOLVO\b/] },
  { slug: "SAAB", patterns: [/\bSAAB\b/] },
  { slug: "LAND-ROVER", patterns: [/\bLAND\s+ROVER\b/, /\bLAND-ROVER\b/] },
  { slug: "JAGUAR", patterns: [/\bJAGUAR\b/] },
  { slug: "MINI", patterns: [/\bMINI\s+COOPER\b/, /\bMINI\b/] },
  { slug: "JEEP", patterns: [/\bJEEP\b/] },
  { slug: "DODGE", patterns: [/\bDODGE\b/] },
  { slug: "CHRYSLER", patterns: [/\bCHRYSLER\b/] },
  { slug: "CADILLAC", patterns: [/\bCADILLAC\b/] },
  { slug: "TESLA", patterns: [/\bTESLA\b/] },
  { slug: "LADA", patterns: [/\bLADA\b/, /\bВАЗ\b/, /\bЛАДА\b/] },
  { slug: "UAZ", patterns: [/\bUAZ\b/, /\bУАЗ\b/] },
  { slug: "GAZ", patterns: [/\bGAZ\b/, /\bГАЗ\b/] },
  { slug: "CHERY", patterns: [/\bCHERY\b/] },
  { slug: "GEELY", patterns: [/\bGEELY\b/] },
  { slug: "HAVAL", patterns: [/\bHAVAL\b/] },
  { slug: "GREAT-WALL", patterns: [/\bGREAT\s+WALL\b/, /\bGREAT-WALL\b/] },
  { slug: "JAC", patterns: [/\bJAC\b/] },
  { slug: "CHANGAN", patterns: [/\bCHANGAN\b/] },
  { slug: "EXEED", patterns: [/\bEXEED\b/] },
  { slug: "OMODA", patterns: [/\bOMODA\b/] },
  { slug: "CHERYEXEED", patterns: [/\bCHERYEXEED\b/] },
];

const BRAND_TITLE_OVERRIDES = {
  BMW: "BMW",
  KIA: "KIA",
  UAZ: "УАЗ",
  GAZ: "ГАЗ",
  JAC: "JAC",
  SSANGYONG: "SsangYong",
  VOLKSWAGEN: "Volkswagen",
  "LAND-ROVER": "Land Rover",
  "ALFA-ROMEO": "Alfa Romeo",
  "GREAT-WALL": "Great Wall",
};

/** @param {string} s */
function toTitleCase(s) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

/**
 * @typedef {{ slug: string, title: string }} CarBrandMeta
 * @type {CarBrandMeta[]}
 */
export const CAR_BRAND_META = CAR_BRANDS.map((b) => ({
  slug: b.slug,
  title: BRAND_TITLE_OVERRIDES[b.slug] ?? toTitleCase(b.slug),
}));

/**
 * Возвращает массив slug'ов марок авто, упомянутых в наименовании.
 * Пустой массив если ничего не распознано (универсальный товар).
 * @param {string} name
 * @returns {string[]}
 */
export function detectCarBrands(name) {
  const upper = (name || "").toUpperCase();
  const found = [];
  for (const b of CAR_BRANDS) {
    for (const re of b.patterns) {
      if (re.test(upper)) {
        found.push(b.slug);
        break;
      }
    }
  }
  return found;
}
