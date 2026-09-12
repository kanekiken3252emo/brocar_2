/**
 * Чинит «битые» названия деталей из ЖИВЫХ ответов поставщиков.
 *
 * Корень проблемы — порча на стороне поставщика (подтверждено на Armtek: в JSON
 * буквально приходит, например, "KopfstГ tze"). Мы декодируем UTF-8
 * корректно — данные битые в каталоге поставщика. Видели два класса:
 *
 *  1) Полный мусор: «Р С С Р» вместо «крюк», «Р РёР С Р С Р С» вместо «Фиксатор».
 *     У каждого 2-байтного UTF-8 символа второй байт заменён пробелом, а первый
 *     раскодирован как кириллица — восстановить исходные буквы нельзя. Зато для
 *     того же артикула Armtek отдаёт и ЧИСТЫЙ дубль («крюк», «Haken»). Поэтому
 *     лечим выбором наименее битого названия среди вариантов (см. nameScore +
 *     выбор в groupOffers/dedupeGroups).
 *
 *  2) Потеря умляута: «KopfstГ tze» вместо «Kopfstütze». Латинская буква «ü»
 *     (UTF-8 C3 BC) потеряла второй байт: C3 уцелел и раскодировался как
 *     кириллическая «Г» (U+0413), BC стал пробелом. Восстанавливаем точечно:
 *     латиница + «Г»(+пробел) + латиница → «ü». В данных Armtek единственный
 *     встречающийся умляут — ü (Kopfstütze); правило срабатывает ТОЛЬКО внутри
 *     латинского слова, поэтому кириллические названия не трогает.
 */

const HAS_LAT = /[A-Za-z]/;
const HAS_CYR = /[А-Яа-яЁё]/;

// Точечные расшифровки подтверждённых обрезанных названий поставщиков.
// Общим правилом такие строки восстановить нельзя: поставщик отдаёт только
// усечённое иностранное слово без категории товара.
const EXACT_NAME_REPAIRS: Record<string, string> = {
  HEIZUNGSHEBELBOCK: "Кронштейн рычага отопителя",
  "SPRING,COIL-REAR": "Рессора задняя в сборе",
  ZYLINDERSKUPPLU: "Цилиндр сцепления рабочий",
};

/** Точечный ремонт восстановимых артефактов битой кодировки. */
export function repairSupplierName(name: string): string {
  if (!name) return name;
  const trimmed = name.trim();
  const repairedExact = EXACT_NAME_REPAIRS[trimmed.toUpperCase()] ?? trimmed;
  return repairedExact
    // Длинный хвост `подходит для ...` — это применяемость, а не название.
    .replace(/\s+подходит для\s+[\s\S]*$/i, " ")
    // В выгрузках знак `\` отделяет основное наименование от длинного списка
    // применяемости. В H1 оставляем только название товара; применяемость живёт
    // в характеристиках и не должна раздувать заголовок.
    .replace(/\\[\s\S]*$/, " ")
    // `!` у поставщиков используется как технический разделитель, а не как
    // часть названия: `фильтр масляный !\...` → `фильтр масляный`.
    .replace(/!+/g, " ")
    .replace(/\bмаслянный\b/gi, "масляный")
    // латиница + «Г»(U+0413, +возможный пробел) + латиница → утраченный умляут ü
    // (Kopfst‹Г› tze → Kopfstütze). Кириллицу не затрагивает.
    .replace(/([A-Za-z]) ?Г ?(?=[A-Za-z])/g, "$1ü")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Похоже ли название на mojibake (битую кодировку) — после попытки ремонта. */
export function looksMojibake(name: string): boolean {
  if (!name) return false;
  // латиница и кириллическая «Г» слиплись внутри слова (несработавший умляут и пр.)
  if (/[A-Za-z]Г|Г[A-Za-z]/.test(name)) return true;
  // цепочка одиночных кириллических заглавных через пробел: «Р С С Р»
  if (/(?:^|\s)[А-Я](?:\s[А-Я]){2,}(?:\s|$)/.test(name)) return true;
  return false;
}

/**
 * Оценка «читабельности» названия — чтобы выбрать лучшее среди дублей одного
 * товара. Чем выше, тем лучше. Битые проваливаются резко вниз.
 */
export function nameScore(name: string): number {
  const s = (name || "").trim();
  if (!s) return -1e9;
  let score = 0;
  if (looksMojibake(s)) score -= 1000;
  // осколки-одиночки («Р С С Р» → четыре однобуквенных «слова») — штраф
  const singles = (s.match(/(?:^|\s)[А-Яа-яA-Za-z](?=\s|$)/g) || []).length;
  score -= singles * 5;
  // объём осмысленного текста (до разумного потолка) — плюс
  score += Math.min(s.replace(/[^А-Яа-яЁёA-Za-z]/g, "").length, 40);
  // для русского магазина при прочих равных слегка предпочитаем кириллицу
  if (HAS_CYR.test(s) && !HAS_LAT.test(s)) score += 2;
  return score;
}

/** Выбирает лучшее из двух названий (с ремонтом). */
export function pickBetterName(a: string, b: string): string {
  const ra = repairSupplierName(a || "");
  const rb = repairSupplierName(b || "");
  return nameScore(rb) > nameScore(ra) ? rb : ra;
}

/** Нормализованное значение для сравнения названия с брендом и артикулом. */
function identityKey(value: string): string {
  return (value || "").toLocaleLowerCase("ru-RU").replace(/[^a-zа-яё0-9]/gi, "");
}

/**
 * Можно ли безопасно использовать название поставщика в H1 и метатегах.
 *
 * Отбрасываем не только mojibake, но и технические заглушки: один артикул,
 * один бренд, строки без слов и характерные обрезанные названия поставщиков
 * вроде `ZYLINDERSKUPPLU` (длинное слово только из латинских заглавных).
 */
export function isUsableProductName(
  name: string | null | undefined,
  article = "",
  brand = ""
): boolean {
  const value = repairSupplierName(name || "");
  if (!value || value.length > 220) return false;
  if (looksMojibake(value) || /[\u0000-\u001f\u007f�]/.test(value)) return false;

  // Знак вопроса вместо потерянной буквы внутри слова (`Santa F?`) означает,
  // что строка повреждена. Восклицательный знак сам по себе не бракуем:
  // поставщики иногда законно используют его в пометках вроде `ОРИГИНАЛ!`.
  if (/[A-Za-zА-Яа-яЁё]\?(?:\s|$)/.test(value)) return false;

  const letters = value.match(/[A-Za-zА-Яа-яЁёÀ-ÖØ-öø-ÿ]/g) || [];
  if (letters.length < 3) return false;

  const key = identityKey(value);
  if (!key || key === identityKey(article) || key === identityKey(brand)) {
    return false;
  }

  const latinLetters = value.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) || [];
  const hasLowerLatin = /[a-zà-öø-ÿ]/.test(value);
  const hasCyrillic = /[А-Яа-яЁё]/.test(value);
  const isSingleToken = !/\s/.test(value);
  if (
    isSingleToken &&
    !hasCyrillic &&
    !hasLowerLatin &&
    latinLetters.length >= 14
  ) {
    return false;
  }

  return true;
}

/** Единое безопасное название для H1, Description, JSON-LD и корзины. */
export function getSafeProductName(
  name: string | null | undefined,
  article: string,
  brand = ""
): string {
  const repaired = repairSupplierName(name || "");
  if (isUsableProductName(repaired, article, brand)) return repaired;

  return ["Запчасть", brand.trim(), article.trim()].filter(Boolean).join(" ");
}

/** SEO-шаблон товарной карточки без общего суффикса `| BroCar` из layout. */
export function buildProductSeoTitle(
  name: string | null | undefined,
  article: string,
  brand = "",
  minimumPrice: number | null = null
): string {
  const usableName = isUsableProductName(name, article, brand);
  const safeName = getSafeProductName(name, article, brand);
  const parts = usableName ? [brand.trim(), article.trim(), safeName] : [safeName];

  parts.push("купить в Екатеринбурге");
  if (
    minimumPrice !== null &&
    Number.isFinite(minimumPrice) &&
    minimumPrice > 0
  ) {
    parts.push(
      `- цена от ${new Intl.NumberFormat("ru-RU", {
        maximumFractionDigits: 0,
      }).format(minimumPrice)} ₽`
    );
  }

  return parts.filter(Boolean).join(" ");
}
