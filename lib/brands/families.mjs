// Семейства брендов-ОРИГИНАЛОВ: один концерн продаёт одну и ту же деталь под
// разными ярлыками (Citroën ↔ Peugeot ↔ PSA ↔ DS; Toyota ↔ Lexus; GM ↔ Opel…).
//
// ОТЛИЧИЕ от BRAND_CLUSTERS (canonical.mjs): кластеры СЛИВАЮТ ярлыки в одну
// карточку (только когда это буквально одна строка бренда), а семейства НЕ
// сливают карточки — они отвечают на вопрос «этот бренд — оригинал для той же
// машины?» при подборе: буст выдачи, выбор главной группы карточки, отметка
// «оригинал» у аналогов. Peugeot и Citroën остаются разными карточками, но
// оба считаются «своими» для машины Citroën.
//
// Ключи — brandKey() (lowercase, только буквы/цифры). Дополнять по мере
// появления реальных ярлыков у поставщиков.
import { brandKey } from "./canonical.mjs";

const FAMILIES = [
  // Stellantis-PSA: Peugeot / Citroën / DS (+ составные ярлыки и «PSA»).
  // "citron" — это «Citroën»: ë выпадает при нормализации brandKey.
  ["peugeot", "citroen", "citron", "ds", "dsautomobiles", "psa", "peugeotcitroen", "citroenpeugeot"],
  // GM: Opel и остальные марки концерна (пример владельца: OPEL → GM)
  ["gm", "generalmotors", "opel", "vauxhall", "chevrolet", "holden", "buick", "cadillac", "pontiac", "saturn", "daewoo", "deawoo", "ravon", "opelgm", "gmopel"],
  // Toyota / Lexus / Daihatsu / Scion / Hino
  ["toyota", "lexus", "daihatsu", "scion", "hino", "toyotalexus", "lexustoyota", "toyotamotor"],
  // Hyundai / Kia / Mobis / Genesis
  ["hyundai", "kia", "mobis", "genesis", "hyundaikia", "kiahyundai", "hyundaimobis"],
  // VAG: Volkswagen / Audi / Skoda / Seat / Porsche / Bentley.
  // "koda" — это «Škoda»: š выпадает при нормализации brandKey.
  ["vag", "volkswagen", "vw", "audi", "skoda", "koda", "seat", "cupra", "porsche", "bentley", "vwaudi", "audivw", "vwvag", "vagvw"],
  // Nissan / Infiniti / Datsun
  ["nissan", "infiniti", "datsun", "nissaninfiniti"],
  // Honda / Acura
  ["honda", "acura"],
  // Mercedes-Benz / Smart / Maybach
  ["mercedes", "mercedesbenz", "mb", "daimler", "smart", "maybach"],
  // BMW / Mini / Rolls-Royce / BMW Motorrad
  ["bmw", "mini", "bmwmini", "rollsroyce", "bmwmotorrad"],
  // Renault / Dacia / Lada (Largus и др. — общие артикулы с Renault)
  ["renault", "dacia", "renaultdacia", "lada", "vaz", "avtovaz", "ваз", "автоваз", "лада"],
  // FCA: Fiat / Alfa Romeo / Lancia + Chrysler / Jeep / Dodge / Mopar
  ["fiat", "fiatprofessional", "alfaromeo", "lancia", "abarth", "chrysler", "jeep", "dodge", "ram", "mopar"],
  // Jaguar Land Rover
  ["landrover", "rangerover", "jaguar", "jaguarlandrover", "jlr"],
  // Mitsubishi
  ["mitsubishi", "mmc"],
  // Ford
  ["ford", "motorcraft", "fomoco"],
  // Volvo
  ["volvo", "polestar"],
  // Chery: Exeed / Omoda / Jaecoo — один концерн, общие детали
  ["chery", "exeed", "omoda", "jaecoo", "cheryexeed"],
  // Great Wall: Haval / Tank / WEY / ORA
  ["greatwall", "gwm", "haval", "tank", "wey", "ora"],
  // Geely: Belgee (сборка РБ) / Livan
  ["geely", "belgee", "livan"],
  // SAIC: MG / Roewe / Maxus
  ["saic", "mg", "roewe", "maxus", "ldv"],
  // Dongfeng
  ["dongfeng", "dfm"],
  // ГАЗ / Соболь-ярлыки
  ["gaz", "газ", "gazgroup"],
  // УАЗ
  ["uaz", "уаз", "sollers"],
];

const keyToFamily = new Map();
FAMILIES.forEach((fam, i) => {
  for (const k of fam) keyToFamily.set(k, i);
});

/**
 * Один ли это производитель-оригинал (с учётом семейств концернов).
 * "CITROEN" ↔ "PSA" ↔ "Peugeot/Citroen" → true; "CITROEN" ↔ "SAT" → false.
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
/**
 * Номер семейства концерна для бренда (или null, если бренд не в таблице).
 * Нужен для склейки «один артикул + один концерн = одна карточка».
 * @param {unknown} brand
 * @returns {number | null}
 */
export function brandFamilyId(brand) {
  const id = keyToFamily.get(brandKey(brand));
  return id === undefined ? null : id;
}

export function sameBrandFamily(a, b) {
  const ka = brandKey(a);
  const kb = brandKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const fa = keyToFamily.get(ka);
  const fb = keyToFamily.get(kb);
  if (fa !== undefined && fa === fb) return true;
  // Составные ярлыки вне таблицы («TOYOTA MOTOR» и т.п.): вхождение ключа.
  if (ka.length >= 4 && kb.includes(ka)) return true;
  if (kb.length >= 4 && ka.includes(kb)) return true;
  return false;
}
