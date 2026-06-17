/**
 * Извлечение структурированных характеристик (атрибутов) товара из его
 * наименования — для фасетных фильтров на странице категории.
 *
 * Та же идея, что и в classifier-data.mjs (категория/марки из названия),
 * только результат — словарь { ключ: значение } для конкретной категории.
 *
 * Чистый ESM (.mjs) без TypeScript — один и тот же код используют:
 *   • рантайм Next.js → через обёртку lib/catalog/attributes.ts (с типами);
 *   • скрипты импорта/бэкафилла → прямой импорт.
 *
 * ВАЖНО: значения нормализуем к каноничному виду (5W-40, «4 л»,
 * «Синтетическое»), чтобы одинаковые по сути варианты схлопывались в один
 * пункт фасета, а не плодили дубликаты из-за разного написания в прайсе.
 *
 * Прототип: пока включена ОДНА категория — engine-oils. Чтобы добавить
 * новую, достаточно описать её в ATTRIBUTE_META и завести экстрактор в
 * EXTRACTORS — остальной конвейер (БД/API/UI) уже динамический.
 */

/**
 * Описание фасетов по категориям: какие атрибуты показывать, под каким
 * заголовком, в каком порядке и как сортировать значения.
 *
 * sort:
 *   "viscosity" — по классу вязкости (0W-20 < 5W-30 < 10W-40 …)
 *   "numeric"   — по числу, вытащенному из значения («1 л» < «4 л» < «20 л»)
 *   "list"      — в порядке массива `order`
 *   (по умолчанию — по алфавиту)
 *
 * @typedef {{ key: string, label: string, sort?: "viscosity"|"numeric"|"list", order?: string[] }} AttributeMeta
 * @type {Record<string, AttributeMeta[]>}
 */
export const ATTRIBUTE_META = {
  "engine-oils": [
    {
      key: "oil_type",
      label: "Тип",
      sort: "list",
      order: ["Синтетическое", "Полусинтетическое", "Минеральное"],
    },
    { key: "viscosity", label: "Вязкость", sort: "viscosity" },
    { key: "volume", label: "Объём, л", sort: "numeric" },
  ],
  "transmission-oils": [
    {
      key: "trans_type",
      label: "Тип",
      sort: "list",
      order: ["ATF (АКПП)", "CVT (вариатор)", "Трансмиссионное (МКПП)"],
    },
    { key: "viscosity", label: "Вязкость", sort: "viscosity" },
    { key: "volume", label: "Объём, л", sort: "numeric" },
  ],
  coolants: [
    {
      key: "coolant_ready",
      label: "Тип",
      sort: "list",
      order: ["Готовый", "Концентрат"],
    },
    {
      key: "coolant_class",
      label: "Класс",
      sort: "list",
      order: ["G11", "G12", "G12+", "G12++", "G13"],
    },
    { key: "color", label: "Цвет" },
  ],
  "brake-fluids": [
    {
      key: "dot",
      label: "Класс DOT",
      sort: "list",
      order: ["DOT 3", "DOT 4", "DOT 5.1", "DOT 5"],
    },
    { key: "volume", label: "Объём, л", sort: "numeric" },
  ],
  "washer-fluids": [
    {
      key: "washer_type",
      label: "Тип",
      sort: "list",
      order: ["Готовая", "Концентрат"],
    },
    { key: "washer_temp", label: "Температура замерзания", sort: "numeric" },
    { key: "volume", label: "Объём, л", sort: "numeric" },
  ],
};

/** Есть ли у категории описанные фасеты. */
export function hasAttributes(slug) {
  return Array.isArray(ATTRIBUTE_META[slug]) && ATTRIBUTE_META[slug].length > 0;
}

// ── Переиспользуемые матчеры ────────────────────────────────────────────────

/**
 * Класс вязкости масла (двойной): 5W-40, 0W-20, 10W/60, 5W30, SAE 5W-30 →
 * «5W-40». Разделитель — только дефис/слэш или его отсутствие (НЕ пробел):
 * иначе моногрейд + объём «70W 1л» ложно склеился бы в «70W-1».
 */
export function matchViscosity(name) {
  const m = String(name).match(/\b(\d{1,2})[wW][-/]?(\d{1,3})\b/);
  if (!m) return null;
  return `${m[1]}W-${m[2]}`;
}

/**
 * Вязкость для трансмиссионных масел: сперва двойная (75W-90, 80W-140),
 * затем моногрейд (70W, 75W, 80W). У ATF/CVT класса SAE обычно нет — вернёт null.
 */
export function matchTransViscosity(name) {
  const di = matchViscosity(name);
  if (di) return di;
  const mono = String(name).match(/\b(\d{2,3})[wW]\b/);
  return mono ? `${mono[1]}W` : null;
}

/**
 * Объём в литрах: 1л, 4л, 20 л, 5Л, 0,946л, «5 литров», 4ЛИТРА, 20L, (1л).
 * Нормализует запятую в точку, отсекает явный шум (≤0 или > 240 л — это уже
 * не литраж, а кусок артикула). Возвращает каноничную метку «4 л» / «0.946 л».
 */
export function matchVolume(name) {
  // Приводим к нижнему регистру: \b в JS не работает с кириллицей, поэтому
  // вместо границы слова используем lookahead «после единицы — не буква и не
  // цифра». Так «1л», «20 л», «5л», «0,946л», «5 литров», «4литра», «20l»
  // ловятся, а «л» внутри слова или артикула — нет.
  const n = String(name).toLowerCase();

  const litres = n.match(/(\d+(?:[.,]\d+)?)\s*(?:литр[а-яё]*|л|l)(?![а-яёa-z0-9])/);
  if (litres) {
    const val = parseFloat(litres[1].replace(",", "."));
    // Нижний порог 0.05 л отсекает вырожденные значения из кривых прайсов
    // (напр. «0,475мл» → 0.0005 л → «0 л»).
    if (isFinite(val) && val >= 0.05 && val <= 240) return fmtLitres(val);
  }

  // Миллилитры → литры (тормозные жидкости часто в мл: «500 мл», «500мл.»).
  // Так «500 мл» и «0,5л» схлопываются в одно значение «0.5 л».
  const millis = n.match(/(\d+(?:[.,]\d+)?)\s*(?:мл|ml)(?![а-яёa-z0-9])/);
  if (millis) {
    const val = parseFloat(millis[1].replace(",", "."));
    if (isFinite(val) && val >= 50 && val <= 5000) return fmtLitres(val / 1000);
  }

  return null;
}

function fmtLitres(v) {
  // Округляем до 3 знаков и убираем хвостовые нули: 4 → «4 л», 0.5 → «0.5 л».
  return `${+v.toFixed(3)} л`;
}

// ── Матчеры для жидкостей ────────────────────────────────────────────────────

/** Класс тормозной жидкости: DOT 3 / DOT 4 / DOT 5.1 / DOT 5. */
export function matchDot(name) {
  const m = String(name).match(/\bdot[\s-]?(5\.1|3|4|5)\b/i);
  return m ? `DOT ${m[1]}` : null;
}

/**
 * Тип трансмиссионной жидкости по применению: вариатор (CVT), АКПП (ATF),
 * МКПП/редуктор (Gear Oil, GL-4/5, моно/двойной SAE). Порядок проверки важен.
 */
export function matchTransType(name) {
  const n = String(name).toLowerCase();
  if (/cvtf?|вариатор/.test(n)) return "CVT (вариатор)";
  if (/\batf\b|mercon|dexron|matic|акпп/.test(n)) return "ATF (АКПП)";
  // Редукторное/МКПП: явные признаки ИЛИ распознанный SAE-класс (75W-90 / 75W).
  // Строгий matchTransViscosity, а не «любое NNw» — иначе «75w» из артикула
  // тормозных колодок ложно метило бы их как трансмиссионку.
  if (
    /gear oil|getrieb|\bgl-?[45]\b|\bmtf\b|редуктор|мкпп|механич/.test(n) ||
    matchTransViscosity(name)
  )
    return "Трансмиссионное (МКПП)";
  return null;
}

const COOLANT_COLORS = [
  [/бесцветн/, "Бесцветный"],
  [/сине-?\s?зел[её]н/, "Сине-зелёный"],
  [/зел[её]н/, "Зелёный"],
  [/красн/, "Красный"],
  [/голуб/, "Голубой"],
  [/син(?:ий|яя|ее|е\b|\b)/, "Синий"],
  [/ж[ёе]лт/, "Жёлтый"],
  [/фиолет/, "Фиолетовый"],
  [/розов/, "Розовый"],
  [/оранж/, "Оранжевый"],
  [/бирюз/, "Бирюзовый"],
];

/** Цвет антифриза. Порядок массива — приоритет (сине-зелёный раньше синего). */
export function matchCoolantColor(name) {
  const n = String(name).toLowerCase();
  for (const [re, label] of COOLANT_COLORS) {
    if (re.test(n)) return label;
  }
  return null;
}

/** Класс охлаждайки по спецификации G: G11 / G12 / G12+ / G12++ / G13. */
export function matchCoolantClass(name) {
  const found = String(name)
    .toLowerCase()
    .match(/g\s?1[123]\+{0,2}/g);
  if (!found) return null;
  // «G12/G12+» → берём вариант с бóльшим числом плюсов (более конкретный).
  let best = found[0];
  const plus = (s) => (s.match(/\+/g) || []).length;
  for (const f of found) if (plus(f) > plus(best)) best = f;
  return best.replace(/\s/g, "").toUpperCase();
}

/** Готовый антифриз или концентрат. */
export function matchCoolantReady(name) {
  const n = String(name).toLowerCase();
  if (/концентрат/.test(n)) return "Концентрат";
  if (/готов|premix|премикс/.test(n)) return "Готовый";
  return null;
}

/**
 * Температура замерзания омывайки: «-20°С», «-80 °C», «-25», «–50С».
 * Допускаем и «голый» минус с числом (в названиях омываек «-NN» — это всегда
 * температура). Трёх- и более значные числа после минуса игнорим (это коды).
 */
export function matchFreezeTemp(name) {
  const m = String(name)
    .toLowerCase()
    .match(/[-–]\s?(\d{1,2})(?=[\s°с,)]|$)/);
  return m ? `-${m[1]} °C` : null;
}

/** Тип омывайки: концентрат или готовая к применению. */
export function matchWasherType(name) {
  const n = String(name).toLowerCase();
  if (/концентрат|конц\.|конц\b/.test(n)) return "Концентрат";
  return "Готовая";
}

/**
 * Тип масла по основе. Полусинтетику проверяем ДО синтетики (она содержит
 * подстроку «синтет»). «полусинтетическоеическое» (опечатка в прайсе) тоже
 * ловится по «полусинтет».
 */
export function matchOilType(name) {
  const n = String(name).toLowerCase();
  if (/полусинтет/.test(n)) return "Полусинтетическое";
  if (/синтет|synthetic|fully[- ]?synth|\bf-?s\b/.test(n)) return "Синтетическое";
  if (/минерал|mineral/.test(n)) return "Минеральное";
  return null;
}

// ── Экстракторы по категориям ──────────────────────────────────────────────

const EXTRACTORS = {
  "engine-oils": (name) => {
    const attrs = {};
    const t = matchOilType(name);
    if (t) attrs.oil_type = t;
    const v = matchViscosity(name);
    if (v) attrs.viscosity = v;
    const vol = matchVolume(name);
    if (vol) attrs.volume = vol;
    return attrs;
  },
  "transmission-oils": (name) => {
    const attrs = {};
    const t = matchTransType(name);
    if (t) attrs.trans_type = t;
    const v = matchTransViscosity(name);
    if (v) attrs.viscosity = v;
    const vol = matchVolume(name);
    if (vol) attrs.volume = vol;
    return attrs;
  },
  coolants: (name) => {
    const attrs = {};
    const r = matchCoolantReady(name);
    if (r) attrs.coolant_ready = r;
    const c = matchCoolantClass(name);
    if (c) attrs.coolant_class = c;
    const col = matchCoolantColor(name);
    if (col) attrs.color = col;
    return attrs;
  },
  "brake-fluids": (name) => {
    const attrs = {};
    const d = matchDot(name);
    if (d) attrs.dot = d;
    const vol = matchVolume(name);
    if (vol) attrs.volume = vol;
    return attrs;
  },
  "washer-fluids": (name) => {
    const attrs = {};
    attrs.washer_type = matchWasherType(name);
    const temp = matchFreezeTemp(name);
    if (temp) attrs.washer_temp = temp;
    const vol = matchVolume(name);
    if (vol) attrs.volume = vol;
    return attrs;
  },
};

/**
 * Извлечь атрибуты товара по (категория, наименование).
 * Возвращает словарь только из найденных ключей ({} если ничего/категория
 * без фасетов). Никогда не бросает.
 */
export function extractAttributes(categorySlug, name) {
  const fn = EXTRACTORS[categorySlug];
  if (!fn || !name) return {};
  try {
    return fn(name) || {};
  } catch {
    return {};
  }
}

/**
 * Сортировщик значений фасета согласно его meta. Используется и на сервере
 * (порядок опций в ответе API), и потенциально на клиенте.
 */
export function makeFacetComparator(meta) {
  if (meta?.sort === "numeric") {
    return (a, b) => parseFloat(a) - parseFloat(b);
  }
  if (meta?.sort === "viscosity") {
    return (a, b) => viscosityRank(a) - viscosityRank(b);
  }
  if (meta?.sort === "list" && Array.isArray(meta.order)) {
    const idx = (v) => {
      const i = meta.order.indexOf(v);
      return i === -1 ? meta.order.length : i;
    };
    return (a, b) => idx(a) - idx(b) || a.localeCompare(b, "ru");
  }
  return (a, b) => a.localeCompare(b, "ru");
}

/** Числовой ранг класса вязкости для сортировки: 5W-40 → 540. */
function viscosityRank(v) {
  const m = String(v).match(/(\d{1,2})W-(\d{1,3})/);
  if (!m) return Number.MAX_SAFE_INTEGER;
  return parseInt(m[1], 10) * 1000 + parseInt(m[2], 10);
}
