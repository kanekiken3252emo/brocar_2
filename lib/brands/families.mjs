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
  // Stellantis-PSA: Peugeot / Citroën / DS (+ составные ярлыки и «PSA»)
  ["peugeot", "citroen", "ds", "dsautomobiles", "psa", "peugeotcitroen", "citroenpeugeot"],
  // GM: Opel и остальные марки концерна (пример владельца: OPEL → GM)
  ["gm", "generalmotors", "opel", "vauxhall", "chevrolet", "holden", "buick", "cadillac", "pontiac", "saturn", "daewoo", "ravon", "opelgm", "gmopel"],
  // Toyota / Lexus / Daihatsu
  ["toyota", "lexus", "daihatsu", "toyotalexus", "lexustoyota"],
  // Hyundai / Kia / Mobis
  ["hyundai", "kia", "mobis", "hyundaikia", "kiahyundai", "hyundaimobis"],
  // VAG: Volkswagen / Audi / Skoda / Seat
  ["vag", "volkswagen", "vw", "audi", "skoda", "seat", "cupra", "vwaudi", "audivw", "vwvag", "vagvw"],
  // Nissan / Infiniti / Datsun
  ["nissan", "infiniti", "datsun", "nissaninfiniti"],
  // Honda / Acura
  ["honda", "acura"],
  // Mercedes-Benz / Smart / Maybach
  ["mercedes", "mercedesbenz", "mb", "daimler", "smart", "maybach"],
  // BMW / Mini
  ["bmw", "mini", "bmwmini"],
  // Renault / Dacia
  ["renault", "dacia", "renaultdacia"],
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
