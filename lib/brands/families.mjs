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

// Состав семейств — СТРОГО по списку владельца от 14.08.2026 («Давай вот так
// попробуем»). Расширять только по его подтверждению. Ключи с диакритикой:
// "citron" = «Citroën», "koda" = «Škoda» (ë/š выпадают в brandKey).
const FAMILIES = [
  // Peugeot/Citroen: Peugeot · Citroën · DS · PSA · Peugeot/Citroen · Citroen/Peugeot
  ["peugeot", "citroen", "citron", "ds", "dsautomobiles", "psa", "peugeotcitroen", "citroenpeugeot", "peugeotcitroenpsa"],
  // General Motors: GM · General Motors · Opel · Chevrolet · Daewoo (и «Deawoo»)
  ["gm", "generalmotors", "opel", "chevrolet", "daewoo", "deawoo", "opelgm", "gmopel"],
  // Toyota/Lexus
  ["toyota", "lexus", "toyotalexus", "lexustoyota"],
  // Hyundai/Kia/Mobis
  ["hyundai", "kia", "mobis", "hyundaikia", "kiahyundai", "hyundaimobis"],
  // VAG: Volkswagen · VW · Audi · Škoda · Seat · Bentley · VAG
  ["vag", "volkswagen", "vw", "audi", "skoda", "koda", "seat", "bentley", "vwaudi", "audivw", "vwvag", "vagvw"],
  // Nissan: Nissan · Infiniti
  ["nissan", "infiniti", "nissaninfiniti"],
  // Mercedes: Mercedes-Benz · MB
  ["mercedes", "mercedesbenz", "mb"],
  // BMW: BMW · BMW Motorrad
  ["bmw", "bmwmotorrad"],
  // Renault: Renault · Dacia
  ["renault", "dacia", "renaultdacia"],
  // FIAT/ALFA ROMEO: Fiat · Fiat Professional · Alfa Romeo
  ["fiat", "fiatprofessional", "alfaromeo"],
  // Land Rover: Land Rover · Range Rover · JLR
  ["landrover", "rangerover", "jlr", "jaguarlandrover"],
  // Mitsubishi: Mitsubishi · MMC
  ["mitsubishi", "mmc"],
  // Ford: Ford · Motorcraft · FoMoCo · Ford Motorcraft
  ["ford", "motorcraft", "fomoco", "fordmotorcraft"],
  // Dongfeng: Dongfeng · DFM
  ["dongfeng", "dfm"],
  // ГАЗ
  ["gaz", "газ", "gazgroup"],
  // УАЗ
  ["uaz", "уаз"],
];

// Принудительное отображаемое имя объединённой карточки семейства.
// Задано только там, где владелец явно попросил (PSA → «Peugeot/Citroen»);
// у остальных ярлык берётся от самой крупной составляющей.
const FAMILY_NAMES = {
  psa: "Peugeot/Citroen/PSA",
};

const keyToFamily = new Map();
FAMILIES.forEach((fam, i) => {
  for (const k of fam) keyToFamily.set(k, i);
});
/** familyId → принудительное имя (если задано через FAMILY_NAMES). */
const familyIdToName = new Map();
for (const [key, name] of Object.entries(FAMILY_NAMES)) {
  const id = keyToFamily.get(key);
  if (id !== undefined) familyIdToName.set(id, name);
}

/**
 * Принудительное отображаемое имя карточки для бренда семейства
 * («PSA» → «Peugeot/Citroen») или null, если не задано.
 * @param {unknown} brand
 * @returns {string | null}
 */
export function familyDisplayName(brand) {
  const id = keyToFamily.get(brandKey(brand));
  if (id === undefined) return null;
  return familyIdToName.get(id) ?? null;
}

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
