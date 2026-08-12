import "server-only";
import { laximoQuery, asArray, laximoImage } from "./client";
import { laximoCached } from "./cache";
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
 * ТАРИФИКАЦИЯ: вызовы по конкретному авто платные — каждый метод обёрнут в
 * 24-часовой кэш (lib/laximo/cache), чтобы «1 VIN = 1 запрос в сутки» и тариф
 * не расходовался на повторную навигацию. См. cache.ts.
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

const normVin = (vin: string) => vin.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

/** Поиск авто по VIN. Возвращает найденные автомобили (обычно один).
 *  Кэшируем identity (catalog+vehicleid+ssd) на 24ч — тот же ssd переиспользуется
 *  для всей навигации, поэтому Laximo считает это одним запросом по VIN. */
async function carInfo(vin: string): Promise<GoodvinCarInfo[]> {
  return laximoCached(`vin:${normVin(vin)}`, async () => {
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
 * Узлы дерева (устаревший постраничный вариант — UI использует getTree). Оставлен
 * для совместимости контракта; не кэшируем, т.к. в новом интерфейсе не вызывается.
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

/** ПОЛНОЕ дерево узлов каталога (постоянное дерево слева, как у Армтека).
 *  Laximo отдаёт всё дерево одним ListQuickGroup. Кэш 24ч по (catalog+vehicleid). */
async function getTree(
  catalogId: string,
  opts: { carId: string; criteria?: string }
): Promise<GoodvinGroupNode[]> {
  return laximoCached(`tree:${catalogId}:${opts.carId}`, async () => {
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
  });
}

/** Детали узла (схемы + OEM-номера + кликабельные выноски). Кэш 24ч по
 *  (catalog+vehicleid+groupId) — один узел тарифицируется не чаще раза в сутки. */
async function getParts(
  catalogId: string,
  opts: { carId: string; groupId: string; criteria?: string }
): Promise<GoodvinParts> {
  return laximoCached(`parts:${catalogId}:${opts.carId}:${opts.groupId}`, async () => {
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

    // Каждый УЗЕЛ (unit) — отдельная группа со СВОЕЙ схемой, выносками и деталями.
    // У сложных групп узлов несколько (напр. «Фильтр салонный» — 2 схемы): раньше
    // показывали только первую, а детали листали от всех → «остальное на картинке
    // не заполнялось». Карту выносок тянем на каждый узел (у узла свой ssd).
    const partGroups = await Promise.all(
      units.map(async (u) => {
        const positions =
          u.unitid && u.ssd
            ? await getUnitImageMap(
                catalogId,
                opts.carId,
                String(u.unitid),
                String(u.ssd)
              )
            : [];
        return {
          name: String(u.name ?? ""),
          number: String(u.code ?? ""),
          positionNumber: "",
          img: laximoImage(u.imageurl as string | undefined),
          imgDescription: u.name ? String(u.name) : undefined,
          positions,
          parts: (asArray(u.Detail) as Array<Record<string, unknown>>).map(
            (d) => ({
              id: String(d.oem ?? d.codeonimage ?? d.name ?? ""),
              nameId: "",
              name: String(d.name ?? ""),
              number: String(d.oem ?? ""),
              positionNumber:
                d.codeonimage != null ? String(d.codeonimage) : undefined,
            })
          ),
        };
      })
    );

    // Верхнеуровневые img/positions оставляем от первого узла (обратная
    // совместимость), но UI рисует каждый узел из partGroups.
    const first = partGroups.find((g) => g.img) ?? partGroups[0];
    return {
      img: first?.img,
      imgDescription: first?.imgDescription,
      partGroups,
      positions: first?.positions ?? [],
    };
  });
}

/** Поиск деталей по названию/номеру внутри каталога авто (SearchVehicleDetails).
 *  Возвращает плоский список {number(OEM), name}. Кэш 24ч по (catalog+vehicleid+запрос). */
async function searchParts(
  catalogId: string,
  opts: { carId: string; criteria?: string; query: string }
): Promise<Array<{ number: string; name: string }>> {
  // Символы-разделители команды (| =) из запроса убираем, чтобы не сломать формат.
  const q = opts.query.replace(/[|=]/g, " ").trim();
  if (!q) return [];
  return laximoCached(
    `search:${catalogId}:${opts.carId}:${q.toLowerCase()}`,
    async () => {
      const resp = await laximoQuery(
        "oem",
        `SearchVehicleDetails:Locale=${LOCALE}|Catalog=${catalogId}|VehicleId=${opts.carId}|ssd=${opts.criteria ?? ""}|Query=${q}`
      );
      const rows = asArray(
        (resp as { SearchVehicleDetails?: { row?: unknown } })
          .SearchVehicleDetails?.row
      ) as Array<Record<string, unknown>>;
      return rows
        .map((r) => ({
          number: String(r.oem ?? ""),
          name: String(r["#text"] ?? "").trim(),
        }))
        .filter((x) => x.number);
    }
  );
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
