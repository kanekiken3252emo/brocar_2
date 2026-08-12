import "server-only";
import { laximoQuery, asArray, laximoImage } from "./client";
import type {
  GoodvinCarInfo,
  GoodvinGroup,
  GoodvinParts,
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

/** Детали узла (схемы + OEM-номера). */
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

  const firstImg = units.find((u) => u.imageurl)?.imageurl as
    | string
    | undefined;

  return {
    img: laximoImage(firstImg),
    imgDescription: units[0]?.name ? String(units[0].name) : undefined,
    partGroups,
    positions: [],
  };
}

/** Совпадает по форме с объектом `goodvin` — роуты подключают вместо него.
 *  Второй аргумент carInfo (catalogs) в Laximo не нужен — принимаем для
 *  совместимости сигнатуры и игнорируем. */
export const laximo = {
  carInfo: (q: string, _catalogs?: string) => carInfo(q),
  getGroups,
  getParts,
};

export type LaximoCatalog = typeof laximo;
