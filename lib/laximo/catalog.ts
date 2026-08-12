import "server-only";
import { laximoQuery, asArray, laximoImage } from "./client";
import type {
  GoodvinCarInfo,
  GoodvinGroup,
  GoodvinGroupNode,
  GoodvinParts,
  GoodvinPartPosition,
} from "@/types/goodvin";

/**
 * Адаптер Laximo.CAT под контракт GoodVin (carInfo → groups → parts), чтобы
 * заменить провайдера VIN-каталога без переделки UI (components/goodvin/VinCatalog).
 *
 * Соответствие сущностей:
 *   GoodVin catalogId  ← Laximo Catalog
 *   GoodVin carId      ← Laximo VehicleId
 *   GoodVin criteria   ← Laximo ssd (сессионный токен, прокидывается сквозь вызовы)
 *   GoodVin groupId    ← Laximo QuickGroupId
 *
 * Locale фиксируем ru_RU (сайт русскоязычный).
 */

const LOCALE = "ru_RU";

type Row = {
  quickgroupid?: string | number;
  link?: string;
  name?: string;
  row?: Row | Row[];
};

type Attr = { key?: string; name?: string; value?: string };

/** Поиск авто по VIN. Возвращает найденные автомобили (обычно один). */
async function carInfo(vin: string): Promise<GoodvinCarInfo[]> {
  const resp = await laximoQuery(
    "oem",
    `FindVehicleByVIN:Locale=${LOCALE}|VIN=${vin}|Localized=true`
  );
  const rows = asArray(
    (resp as { FindVehicleByVIN?: { row?: unknown } }).FindVehicleByVIN?.row
  ) as Array<Record<string, unknown>>;

  return rows.map((r) => {
    const attrs = asArray(r.attribute) as Attr[];
    return {
      title: [r.brand, r.name].filter(Boolean).join(" "),
      catalogId: String(r.catalog ?? ""),
      brand: String(r.brand ?? ""),
      modelId: String(r.catalog ?? ""),
      carId: String(r.vehicleid ?? ""),
      criteria: String(r.ssd ?? ""),
      vin,
      frame: "",
      modelName: String(r.name ?? ""),
      description: attrs
        .map((a) => `${a.name}: ${a.value}`)
        .filter((s) => s !== "undefined: undefined")
        .join("; "),
      groupsTreeAvailable: true,
      parameters: attrs.map((a, i) => ({
        idx: String(i),
        key: a.key ?? "",
        name: a.name ?? "",
        value: a.value ?? "",
        sortOrder: i,
      })),
    } satisfies GoodvinCarInfo;
  });
}

/** Рекурсивный поиск узла дерева по quickgroupid. */
function findNode(rows: Row[], id: string): Row | null {
  for (const r of rows) {
    if (String(r.quickgroupid) === id) return r;
    const kids = asArray(r.row);
    if (kids.length) {
      const found = findNode(kids, id);
      if (found) return found;
    }
  }
  return null;
}

function toGroup(r: Row, parentId?: string): GoodvinGroup {
  return {
    id: String(r.quickgroupid ?? ""),
    parentId,
    hasSubgroups: asArray(r.row).length > 0,
    hasParts: String(r.link) === "true",
    name: String(r.name ?? ""),
  };
}

/**
 * Узлы дерева. Laximo отдаёт всё дерево за один вызов ListQuickGroup, поэтому
 * находим нужный узел и возвращаем его прямых детей (для корня — детей внешней
 * обёртки, чтобы не показывать лишний верхний уровень).
 */
async function getGroups(
  catalogId: string,
  opts: { carId: string; groupId?: string; criteria?: string }
): Promise<GoodvinGroup[]> {
  const resp = await laximoQuery(
    "oem",
    `ListQuickGroup:Locale=${LOCALE}|Catalog=${catalogId}|VehicleId=${opts.carId}|ssd=${opts.criteria ?? ""}`
  );
  const tree = asArray(
    (resp as { ListQuickGroups?: { row?: unknown } }).ListQuickGroups?.row
  ) as Row[];

  let children: Row[];
  if (!opts.groupId) {
    const root = tree[0];
    children = root ? asArray(root.row) : tree;
  } else {
    const node = findNode(tree, opts.groupId);
    children = node ? asArray(node.row) : [];
  }
  return children.map((r) => toGroup(r, opts.groupId));
}

/**
 * Карта выносок (кликабельные зоны на схеме) для узла. Laximo отдаёт её
 * отдельным вызовом ListImageMapByUnit: row(code, x1,y1,x2,y2). Наш UI ждёт
 * coordinates=[x, y, width, height] в пикселях оригинала → переводим из углов.
 * Возвращает пусто при любой ошибке (схема просто останется без кликов).
 */
async function getUnitImageMap(
  catalogId: string,
  carId: string,
  unitId: string,
  ssd: string
): Promise<GoodvinPartPosition[]> {
  try {
    const resp = await laximoQuery(
      "oem",
      `ListImageMapByUnit:Locale=${LOCALE}|Catalog=${catalogId}|VehicleId=${carId}|UnitId=${unitId}|ssd=${ssd}`
    );
    const rows = asArray(
      (resp as { ListImageMapByUnit?: { row?: unknown } }).ListImageMapByUnit
        ?.row
    ) as Array<Record<string, unknown>>;
    return rows
      .map((r) => {
        const x1 = Number(r.x1),
          y1 = Number(r.y1),
          x2 = Number(r.x2),
          y2 = Number(r.y2);
        if (![x1, y1, x2, y2].every(Number.isFinite)) return null;
        return {
          number: String(r.code ?? ""),
          coordinates: [x1, y1, x2 - x1, y2 - y1],
        } satisfies GoodvinPartPosition;
      })
      .filter((p): p is GoodvinPartPosition => p !== null);
  } catch {
    return [];
  }
}

/** ПОЛНОЕ дерево узлов каталога (для постоянного дерева слева, как у Армтека).
 *  Laximo отдаёт всё дерево одним ListQuickGroup — раскрываем на клиенте без
 *  дополнительных запросов. Внешнюю обёртку («Легковые автомобили») пропускаем. */
async function getTree(
  catalogId: string,
  opts: { carId: string; criteria?: string }
): Promise<GoodvinGroupNode[]> {
  const resp = await laximoQuery(
    "oem",
    `ListQuickGroup:Locale=${LOCALE}|Catalog=${catalogId}|VehicleId=${opts.carId}|ssd=${opts.criteria ?? ""}`
  );
  const roots = asArray(
    (resp as { ListQuickGroups?: { row?: unknown } }).ListQuickGroups?.row
  ) as Row[];

  const toNode = (r: Row): GoodvinGroupNode => ({
    id: String(r.quickgroupid ?? ""),
    name: String(r.name ?? ""),
    hasParts: String(r.link) === "true",
    children: asArray(r.row).map(toNode),
  });

  // Одна внешняя обёртка с детьми → показываем её детей верхним уровнем.
  const top =
    roots.length === 1 && asArray(roots[0].row).length
      ? asArray(roots[0].row)
      : roots;
  return top.map(toNode);
}

/** Детали узла (схемы + OEM-номера + кликабельные выноски). */
async function getParts(
  catalogId: string,
  opts: { carId: string; groupId: string; criteria?: string }
): Promise<GoodvinParts> {
  const resp = await laximoQuery(
    "oem",
    `ListQuickDetail:Locale=${LOCALE}|Catalog=${catalogId}|VehicleId=${opts.carId}|QuickGroupId=${opts.groupId}|ssd=${opts.criteria ?? ""}|Localized=true|All=1`
  );
  const cats = asArray(
    (resp as { ListQuickDetail?: { Category?: unknown } }).ListQuickDetail
      ?.Category
  ) as Array<Record<string, unknown>>;
  const units = cats.flatMap((c) =>
    asArray(c.Unit)
  ) as Array<Record<string, unknown>>;

  const partGroups = units.map((u) => ({
    name: String(u.name ?? ""),
    number: String(u.code ?? ""),
    positionNumber: "",
    parts: (asArray(u.Detail) as Array<Record<string, unknown>>).map((d) => ({
      id: String(d.oem ?? d.codeonimage ?? d.name ?? ""),
      nameId: "",
      name: String(d.name ?? ""),
      number: String(d.oem ?? ""),
      positionNumber:
        d.codeonimage != null ? String(d.codeonimage) : undefined,
    })),
  }));

  // Показываем схему первого узла с картинкой и подтягиваем её карту выносок
  // (клик по номеру на схеме → подсветка детали в списке). У узла — свой ssd.
  const displayUnit =
    units.find((u) => u.imageurl && u.unitid && u.ssd) ??
    units.find((u) => u.imageurl);
  const positions =
    displayUnit?.unitid && displayUnit?.ssd
      ? await getUnitImageMap(
          catalogId,
          opts.carId,
          String(displayUnit.unitid),
          String(displayUnit.ssd)
        )
      : [];

  return {
    img: laximoImage(displayUnit?.imageurl as string | undefined),
    imgDescription: displayUnit?.name ? String(displayUnit.name) : undefined,
    partGroups,
    positions,
  };
}

/** Поиск деталей по названию/номеру внутри каталога авто (SearchVehicleDetails).
 *  Возвращает плоский список {number(OEM), name}. Символы-разделители команды
 *  (| =) из запроса убираем, чтобы не сломать формат команды Laximo. */
async function searchParts(
  catalogId: string,
  opts: { carId: string; criteria?: string; query: string }
): Promise<Array<{ number: string; name: string }>> {
  const q = opts.query.replace(/[|=]/g, " ").trim();
  if (!q) return [];
  const resp = await laximoQuery(
    "oem",
    `SearchVehicleDetails:Locale=${LOCALE}|Catalog=${catalogId}|VehicleId=${opts.carId}|ssd=${opts.criteria ?? ""}|Query=${q}`
  );
  const rows = asArray(
    (resp as { SearchVehicleDetails?: { row?: unknown } }).SearchVehicleDetails
      ?.row
  ) as Array<Record<string, unknown>>;
  return rows
    .map((r) => ({
      number: String(r.oem ?? ""),
      name: String(r["#text"] ?? "").trim(),
    }))
    .filter((x) => x.number);
}

/** Совпадает по форме с объектом `goodvin` — роуты подключают вместо него.
 *  Второй аргумент carInfo (catalogs) в Laximo не нужен — принимаем для
 *  совместимости сигнатуры и игнорируем. */
export const laximo = {
  carInfo: (q: string, _catalogs?: string) => carInfo(q),
  getGroups,
  getTree,
  getParts,
  searchParts,
};

export type LaximoCatalog = typeof laximo;
