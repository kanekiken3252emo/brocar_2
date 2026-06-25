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
  lamps: [
    {
      key: "lamp_base",
      label: "Цоколь",
      sort: "list",
      // Частые цоколи — вперёд в понятном порядке, остальные (редкие) уйдут
      // в конец по алфавиту (см. makeFacetComparator → sort: "list").
      order: [
        "H1", "H3", "H4", "H4B", "H7", "H8", "H9", "H11", "H15", "H27",
        "HB3", "HB4", "HB5",
        "D1S", "D2S", "D2R", "D3S", "D4S",
        "W5W", "W21W", "W21/5W", "W3W", "W16W",
        "P21W", "P21/5W", "PY21W", "R5W", "R10W",
        "T4W", "T10", "T20",
      ],
    },
    {
      key: "lamp_type",
      label: "Тип",
      sort: "list",
      order: ["Галогенная", "Светодиодная", "Ксеноновая", "Накаливания"],
    },
    { key: "power", label: "Мощность", sort: "numeric" },
    {
      key: "voltage",
      label: "Напряжение",
      sort: "list",
      order: ["12V", "24V"],
    },
  ],
  "shock-absorbers": [
    {
      key: "position",
      label: "Положение",
      sort: "list",
      order: ["Передний", "Задний"],
    },
    {
      key: "shock_type",
      label: "Тип",
      sort: "list",
      order: ["Газовый", "Масляный"],
    },
  ],
  "brake-pads": [
    {
      key: "position",
      label: "Положение",
      sort: "list",
      order: ["Передние", "Задние"],
    },
    {
      key: "wear_sensor",
      label: "Датчик износа",
      sort: "list",
      order: ["С датчиком", "Без датчика"],
    },
    {
      key: "pad_mix",
      label: "Тип смеси",
      sort: "list",
      order: ["Керамическая", "Semi-Metallic", "Low-Metallic", "Органическая"],
    },
  ],
  "brake-discs": [
    {
      key: "position",
      label: "Положение",
      sort: "list",
      order: ["Передние", "Задние"],
    },
    {
      key: "disc_type",
      label: "Тип",
      sort: "list",
      order: ["Вентилируемый", "Невентилируемый", "Перфорированный"],
    },
    { key: "diameter", label: "Диаметр, мм", sort: "numeric" },
  ],
  batteries: [
    { key: "capacity", label: "Ёмкость, Ач", sort: "numeric" },
    { key: "cranking", label: "Пусковой ток, A", sort: "numeric" },
    {
      key: "polarity",
      label: "Полярность",
      sort: "list",
      order: ["Обратная", "Прямая"],
    },
  ],
  "spark-plugs": [
    {
      key: "plug_material",
      label: "Электрод",
      sort: "list",
      order: ["Иридиевая", "Платиновая", "Никелевая"],
    },
  ],
  wipers: [
    {
      key: "wiper_type",
      label: "Тип",
      sort: "list",
      order: ["Бескаркасная", "Каркасная", "Гибридная"],
    },
  ],
  thermostats: [
    { key: "thermo_temp", label: "Температура открытия", sort: "numeric" },
  ],
  "cv-joints": [
    {
      key: "joint_side",
      label: "Расположение",
      sort: "list",
      order: ["Наружный", "Внутренний"],
    },
    {
      key: "position",
      label: "Положение",
      sort: "list",
      order: ["Передний", "Задний"],
    },
  ],
  springs: [
    {
      key: "position",
      label: "Положение",
      sort: "list",
      order: ["Передняя", "Задняя"],
    },
  ],
  belts: [
    {
      key: "belt_type",
      label: "Тип",
      sort: "list",
      order: ["ГРМ", "Поликлиновой", "Клиновой", "Приводной"],
    },
    { key: "ribs", label: "Число рёбер", sort: "numeric" },
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

// ── Матчеры для ламп ─────────────────────────────────────────────────────────

/**
 * Цоколь лампы из названия. Коды латинские → ASCII `\b` тут корректен
 * (кириллица вокруг считается границей слова). Порядок проверки важен:
 * специфичные семейства (D-ксенон, HB) ДО общего H, иначе «HB4» поймался бы
 * как «H…». Граница справа отсекает артикулы: «KHB4451» — после «HB4» цифра,
 * `\b` не сработает.
 * @param {string} name
 * @returns {string|null}
 */
export function matchLampBase(name) {
  const n = String(name).toUpperCase();
  let m;
  // Ксенон D1S/D2S/D2R/D3S/D4S…
  if ((m = n.match(/\bD[1-8][SR]\b/))) return m[0];
  // HB1…HB5 (и H4B — двухнитевой H4 с маркировкой B) — до общего H.
  if ((m = n.match(/\bH[1-9]\d?B\b/))) return m[0];
  if ((m = n.match(/\bHB[1-5]\b/))) return m[0];
  // H1, H3, H4, H7, H8, H9, H11, H15, H27…
  if ((m = n.match(/\bH[1-9]\d?\b/))) return m[0];
  // Безцокольные/софитные с маркировкой мощности: W5W, W21/5W, W3W, W16W.
  if ((m = n.match(/\bW\d{1,2}(?:\/\d{1,2})?W\b/))) return m[0];
  // P21W, PY21W, P21/5W.
  if ((m = n.match(/\bP[A-Z]?\d{1,2}(?:\/\d{1,2})?W\b/))) return m[0];
  // R5W, R10W.
  if ((m = n.match(/\bR\d{1,2}W\b/))) return m[0];
  // Бесцокольные «таблетки/трубки» T4W, T10, T20 — последними (наименее
  // специфичны: код T-формы часто соседствует с настоящим цоколем W3W).
  if ((m = n.match(/\bT\d{1,2}W?\b/))) return m[0];
  return null;
}

/**
 * Тип лампы по технологии. LED → ксенон → галоген → накаливания. D-цоколь
 * (газоразрядный) трактуем как ксенон, даже если слова «ксенон» нет.
 * @param {string} name
 * @returns {string|null}
 */
export function matchLampType(name) {
  const n = String(name).toLowerCase();
  if (/светодиод|\bled\b/.test(n)) return "Светодиодная";
  if (/ксенон|газоразряд|xenon/.test(n) || /\bd[1-8][sr]\b/i.test(n))
    return "Ксеноновая";
  if (/галоген|halogen/.test(n)) return "Галогенная";
  if (/накалив/.test(n)) return "Накаливания";
  return null;
}

/**
 * Мощность лампы (Вт). Берём цифры с «W», идущие ПОСЛЕ напряжения («12V 55W»,
 * «12V60/55W»), чтобы не спутать с цифрами цоколя (W21/5W стоит до вольтажа).
 * Двухнитевые — «60/55W». Нормализуем к «55W» / «60/55W».
 * @param {string} name
 * @returns {string|null}
 */
export function matchPower(name) {
  const m = String(name)
    .toUpperCase()
    .match(/\b\d{1,2}V\s*(\d{1,3}(?:\/\d{1,3})?)\s*W\b/);
  return m ? `${m[1]}W` : null;
}

/** Напряжение лампы: 12V / 24V. @param {string} name @returns {string|null} */
export function matchVoltage(name) {
  const m = String(name)
    .toUpperCase()
    .match(/\b(\d{1,2})V\b/);
  return m ? `${m[1]}V` : null;
}

// ── Матчеры для подвески (амортизаторы) ─────────────────────────────────────

/**
 * Положение детали: передний/задний. Кириллица → НЕ `\b` (в JS `\b` работает
 * только с ASCII): используем подстроки и lookahead «не буква». «перед» ловит
 * передний/передней/передней подвески; «пер.» — частое сокращение. Если в
 * названии и перёд, и зад (двусторонний/неоднозначный комплект) — не присваиваем.
 * @param {string} name
 * @returns {string|null}
 */
export function matchPosition(name, front = "Передний", rear = "Задний") {
  const n = String(name).toLowerCase();
  const f = /перед|пер\./.test(n);
  const r = /задн|зад(?![а-яё])/.test(n);
  if (f && !r) return front;
  if (r && !f) return rear;
  return null;
}

/**
 * Тип амортизатора: газовый / масляный. «газ» как голую подстроку НЕ берём —
 * она сидит в марке «ГАЗ»/«ГАЗель». Только «газов(ый)», «[газ]» и латинское GAS.
 * @param {string} name
 * @returns {string|null}
 */
export function matchShockType(name) {
  const n = String(name).toLowerCase();
  if (/газов|\[газ\]|\bgas\b/.test(n)) return "Газовый";
  if (/маслян|\boil\b/.test(n)) return "Масляный";
  return null;
}

// ── Матчеры для тормозов ────────────────────────────────────────────────────

/**
 * Наличие датчика износа у колодок. «без датчика» — явно НЕТ; иначе любое
 * упоминание датчика/проводов-сигнализаторов — есть. Прочее — null (неизвестно).
 * @param {string} name
 * @returns {string|null}
 */
export function matchWearSensor(name) {
  const n = String(name).toLowerCase();
  if (/без датчик|без провод|w\/o sensor/.test(n)) return "Без датчика";
  if (/датчик|сигнализатор|с проводом|wear sensor|with sensor/.test(n))
    return "С датчиком";
  return null;
}

/**
 * Фрикционная смесь колодок. Керамика → semi → low → органика.
 * @param {string} name
 * @returns {string|null}
 */
export function matchPadMix(name) {
  const n = String(name).toLowerCase();
  if (/керамич|ceramic/.test(n)) return "Керамическая";
  if (/semi[\s-]?metallic|полуметалл/.test(n)) return "Semi-Metallic";
  if (/low[\s-]?metallic|низкометалл/.test(n)) return "Low-Metallic";
  if (/органич|organic/.test(n)) return "Органическая";
  return null;
}

/**
 * Тип тормозного диска. Невентилируемый проверяем ДО вентилируемого
 * (содержит подстроку «вентилир»).
 * @param {string} name
 * @returns {string|null}
 */
export function matchDiscType(name) {
  const n = String(name).toLowerCase();
  if (/перфор/.test(n)) return "Перфорированный";
  if (/невентил/.test(n)) return "Невентилируемый";
  if (/вентилир/.test(n)) return "Вентилируемый";
  return null;
}

/**
 * Диаметр тормозного диска в мм: «D=303мм», «D321мм», «Ø 280», «280 mm»,
 * «375x36» (перед «x» — толщина). Берём 2–3 значное число у маркера диаметра.
 * Тормозные диски ~ 200–420 мм; вне диапазона — это код/толщина, отсекаем.
 * @param {string} name
 * @returns {string|null}
 */
export function matchDiameter(name) {
  const n = String(name).toLowerCase();
  const m =
    n.match(/[dø][=\s]*?(\d{3})(?![\d.])/i) ||
    n.match(/(\d{3})\s*(?:мм|mm)(?![а-яёa-z0-9])/);
  if (!m) return null;
  const val = parseInt(m[1], 10);
  if (val < 180 || val > 440) return null;
  return `${val} мм`;
}

// ── Матчеры для АКБ ─────────────────────────────────────────────────────────

/**
 * Ёмкость АКБ в А·ч: «60 А/ч», «75Ah», «90 Ah», «6СТ-75». Диапазон 30–250.
 * @param {string} name
 * @returns {string|null}
 */
export function matchCapacity(name) {
  const n = String(name).toLowerCase();
  const m =
    n.match(/(\d{2,3})\s*(?:а[\s.]*\/?\s*ч|ah|ач)(?![а-яёa-z0-9])/) ||
    n.match(/6ст[-\s]?(\d{2,3})/);
  if (!m) return null;
  const val = parseInt(m[1], 10);
  if (val < 30 || val > 250) return null;
  return `${val} Ач`;
}

/**
 * Пусковой ток АКБ (EN), A: «630A», «710 А», «EN 540». 3–4 значное число
 * у маркера «A/А» (НЕ путать с ёмкостью — у неё 2–3 цифры и единица Ач).
 * @param {string} name
 * @returns {string|null}
 */
export function matchCranking(name) {
  const n = String(name).toLowerCase();
  const m = n.match(/(\d{3,4})\s*[aа](?![а-яёa-z0-9.\/])/);
  if (!m) return null;
  const val = parseInt(m[1], 10);
  if (val < 150 || val > 1500) return null;
  return `${val} A`;
}

/**
 * Полярность АКБ: обратная / прямая. Только надёжные слова — R+/L+ и
 * «слева/справа» неоднозначны у разных стандартов, их не берём.
 * @param {string} name
 * @returns {string|null}
 */
export function matchPolarity(name) {
  const n = String(name).toLowerCase();
  if (/обратн|обр\./.test(n)) return "Обратная";
  if (/прям/.test(n)) return "Прямая";
  return null;
}

// ── Матчеры для свечей и щёток ──────────────────────────────────────────────

/** Материал центрального электрода свечи. @param {string} name @returns {string|null} */
export function matchPlugMaterial(name) {
  const n = String(name).toLowerCase();
  if (/иридий|иридиев|iridium|\bir\b/.test(n)) return "Иридиевая";
  if (/платин|platinum/.test(n)) return "Платиновая";
  if (/никел|nickel/.test(n)) return "Никелевая";
  return null;
}

/** Конструкция щётки стеклоочистителя. Бескаркасная — до каркасной (подстрока). */
export function matchWiperType(name) {
  const n = String(name).toLowerCase();
  if (/гибрид|hybrid/.test(n)) return "Гибридная";
  if (/бескаркас/.test(n)) return "Бескаркасная";
  if (/каркас/.test(n)) return "Каркасная";
  return null;
}

// ── Матчеры для термостатов, ШРУСов, ремней ─────────────────────────────────

/**
 * Температура открытия термостата, °C: «89°C», «88 C», «(102 C)», «85°C».
 * Латинская C и кириллическая С обе допустимы. Диапазон 60–120 (вне — это код
 * или год: «77TH058», «85-89»). Граница справа — не буква/цифра.
 * @param {string} name
 * @returns {string|null}
 */
export function matchThermoTemp(name) {
  const m = String(name)
    .toLowerCase()
    .match(/(\d{2,3})\s*°?\s*[cс](?![а-яёa-z0-9])/);
  if (!m) return null;
  const val = parseInt(m[1], 10);
  if (val < 60 || val > 120) return null;
  return `${val} °C`;
}

/**
 * Расположение ШРУСа: наружный / внутренний. «наруж»/«внешн» → наружный;
 * «внутр» → внутренний.
 * @param {string} name
 * @returns {string|null}
 */
export function matchJointSide(name) {
  const n = String(name).toLowerCase();
  if (/наруж|внешн/.test(n)) return "Наружный";
  if (/внутр/.test(n)) return "Внутренний";
  return null;
}

/**
 * Тип ремня: ГРМ / поликлиновой / клиновой / приводной. Поликлиновой проверяем
 * до клинового (содержит подстроку «клинов»). «Приводной» — общий, последним.
 * @param {string} name
 * @returns {string|null}
 */
export function matchBeltType(name) {
  const n = String(name).toLowerCase();
  if (/грм|timing|зубчат/.test(n)) return "ГРМ";
  if (/поликлин/.test(n)) return "Поликлиновой";
  if (/клинов/.test(n)) return "Клиновой";
  if (/приводн/.test(n)) return "Приводной";
  return null;
}

/**
 * Число рёбер поликлинового ремня из маркировки NPKxxxx: «6PK1885» → «6 рёбер».
 * @param {string} name
 * @returns {string|null}
 */
export function matchBeltRibs(name) {
  const m = String(name)
    .toLowerCase()
    .match(/(\d{1,2})\s?pk\s?\d{2,4}/);
  if (!m) return null;
  const val = parseInt(m[1], 10);
  if (val < 1 || val > 30) return null;
  return `${val} рёбер`;
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
  lamps: (name) => {
    const attrs = {};
    const base = matchLampBase(name);
    if (base) attrs.lamp_base = base;
    const type = matchLampType(name);
    if (type) attrs.lamp_type = type;
    const power = matchPower(name);
    if (power) attrs.power = power;
    const volt = matchVoltage(name);
    if (volt) attrs.voltage = volt;
    return attrs;
  },
  "shock-absorbers": (name) => {
    const attrs = {};
    const pos = matchPosition(name);
    if (pos) attrs.position = pos;
    const t = matchShockType(name);
    if (t) attrs.shock_type = t;
    return attrs;
  },
  "brake-pads": (name) => {
    const attrs = {};
    const pos = matchPosition(name, "Передние", "Задние");
    if (pos) attrs.position = pos;
    const ws = matchWearSensor(name);
    if (ws) attrs.wear_sensor = ws;
    const mix = matchPadMix(name);
    if (mix) attrs.pad_mix = mix;
    return attrs;
  },
  "brake-discs": (name) => {
    const attrs = {};
    const pos = matchPosition(name, "Передние", "Задние");
    if (pos) attrs.position = pos;
    const dt = matchDiscType(name);
    if (dt) attrs.disc_type = dt;
    const d = matchDiameter(name);
    if (d) attrs.diameter = d;
    return attrs;
  },
  batteries: (name) => {
    const attrs = {};
    const cap = matchCapacity(name);
    if (cap) attrs.capacity = cap;
    const cr = matchCranking(name);
    if (cr) attrs.cranking = cr;
    const p = matchPolarity(name);
    if (p) attrs.polarity = p;
    return attrs;
  },
  "spark-plugs": (name) => {
    const attrs = {};
    const m = matchPlugMaterial(name);
    if (m) attrs.plug_material = m;
    return attrs;
  },
  wipers: (name) => {
    const attrs = {};
    const t = matchWiperType(name);
    if (t) attrs.wiper_type = t;
    return attrs;
  },
  thermostats: (name) => {
    const attrs = {};
    const t = matchThermoTemp(name);
    if (t) attrs.thermo_temp = t;
    return attrs;
  },
  "cv-joints": (name) => {
    const attrs = {};
    const side = matchJointSide(name);
    if (side) attrs.joint_side = side;
    const pos = matchPosition(name);
    if (pos) attrs.position = pos;
    return attrs;
  },
  springs: (name) => {
    const attrs = {};
    const pos = matchPosition(name, "Передняя", "Задняя");
    if (pos) attrs.position = pos;
    return attrs;
  },
  belts: (name) => {
    const attrs = {};
    const t = matchBeltType(name);
    if (t) attrs.belt_type = t;
    const ribs = matchBeltRibs(name);
    if (ribs) attrs.ribs = ribs;
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
