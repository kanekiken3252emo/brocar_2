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

// Кластеры брендов-синонимов: РАЗНЫЕ ярлыки одного и того же производителя (OEM),
// которые надо схлопнуть в одну карточку. В отличие от BRAND_MAP (автоген —
// склеивает разные НАПИСАНИЯ одного бренда), здесь РУКАМИ объединяем разные
// бренды-строки одного семейства. Ключ — brandKey(); значение — единое имя.
// Все ключи кластера ведут на одно имя → один ключ группировки → одна карточка.
// ВАЖНО: объединяй только реально один OEM под разными ярлыками. НЕ клади сюда
// «оригинал vs аналог» (например Delphi) — это разные товары с разной ценой.
// Добавляй новые семейства по мере появления, проверяя на живых дублях.
const BRAND_CLUSTERS = {
  // Семейство PSA (Peugeot / Citroen). Один OEM под разными ярлыками поставщиков:
  // "PEUGEOT/CITROEN", "CITROEN/PEUGEOT", "PSA" → одна карточка.
  peugeotcitroen: "Peugeot/Citroen",
  citroenpeugeot: "Peugeot/Citroen",
  psa: "Peugeot/Citroen",
};

/**
 * Каноничное отображаемое имя бренда.
 * 1) кластер брендов-синонимов (BRAND_CLUSTERS) — разные ярлыки одного OEM → одно имя;
 * 2) известный кластер написаний из BRAND_MAP (автоген) → единое написание;
 * 3) иначе — оставляем бренд как есть (схлопнув лишние пробелы). Регистр
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
  const key = brandKey(trimmed);
  return BRAND_CLUSTERS[key] || BRAND_MAP[key] || trimmed;
}
