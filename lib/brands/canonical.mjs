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

// Кластеры брендов-синонимов: РАЗНЫЕ ярлыки одного производителя, схлопнутые
// в одну карточку. СЕЙЧАС ПУСТО — по решению владельца (авг 2026) ярлыки
// концерна показываются ОТДЕЛЬНЫМИ карточками, как у Berg/Армтек: PSA,
// Peugeot/Citroen, Citroen, Peugeot — каждая своя, и все поднимаются наверх
// выдачи как оригиналы через СЕМЕЙСТВА (lib/brands/families.mjs,
// sameBrandFamily). Раньше здесь склеивались peugeotcitroen/citroenpeugeot/psa
// → «Peugeot/Citroen» — вернуть можно, добавив записи вида key: "Имя".
/** @type {Record<string, string>} */
const BRAND_CLUSTERS = {};

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
