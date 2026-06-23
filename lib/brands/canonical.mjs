// Единая нормализация брендов. Используется и приложением (TS, через allowJs),
// и скриптами импорта (.mjs), чтобы каталог, фасеты, фильтры и группировка
// видели один бренд под одним именем.
//
// Проблема: разные поставщики пишут один бренд по-разному
// ("STELLOX"/"Stellox", "LYNXauto"/"LYNX AUTO"/"LYNXAUTO", "Land Rover"/"landrover").
// Решение: агрессивный ключ схлопывает варианты, BRAND_MAP даёт красивое имя.
import { BRAND_MAP } from "./brand-map.mjs";

/**
 * Ключ для склейки вариантов одного бренда: lowercase без пробелов и пунктуации.
 * "Land Rover" / "landrover" / "LAND-ROVER" → "landrover".
 * "MEAT & DORIA" / "MEAT&DORIA" → "meatdoria".
 * @param {unknown} raw
 * @returns {string}
 */
export function brandKey(raw) {
  return typeof raw === "string"
    ? raw.toLowerCase().replace(/[^0-9a-zа-яё]/g, "")
    : "";
}

/**
 * Каноничное отображаемое имя бренда.
 * 1) известный кластер из BRAND_MAP (бренды, у которых в данных есть несколько
 *    написаний) → выбранное там единое написание;
 * 2) иначе — оставляем бренд как есть (схлопнув лишние пробелы). Регистр
 *    одиночных брендов НЕ трогаем: иначе аббревиатуры вроде "HSB"/"TYG"
 *    превратятся в "Hsb"/"Tyg". Новые дубли подхватятся при пересборке карты
 *    (scripts/build-brand-map.mjs).
 * @param {unknown} raw
 * @returns {string}
 */
export function canonicalBrand(raw) {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return BRAND_MAP[brandKey(trimmed)] || trimmed;
}
