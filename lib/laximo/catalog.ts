import "server-only";
import { laximoQuery, asArray, laximoImage, LaximoError } from "./client";
import { laximoCached } from "./cache";
import type {
  GoodvinCarInfo,
  GoodvinGroup,
  GoodvinGroupNode,
  GoodvinPart,
  GoodvinParts,
  GoodvinPartPosition,
} from "@/types/goodvin";

/**
 * Адаптер Laximo.CAT под контракт GoodVin (carInfo → tree → parts), чтобы
 * заменить провайдера VIN-каталога без переделки UI (components/goodvin/VinCatalog).
 *
 * Два режима навигации (у разных каталогов доступен свой):
 *   • "quick" — ListQuickGroup / ListQuickDetail (курируемые группы; ssd авто
 *     работает сквозняком). Большинство каталогов (Audi, Toyota…).
 *   • "cat"   — ListCategories / ListUnits / ListDetailByUnit (полная структура;
 *     ssd СВОЙ у каждой категории/узла). Каталоги без QuickGroup (PSA: Citroën,
 *     Peugeot, DS, Opel). Включается автоматически, если QuickGroup запрещён.
 *
 * ТАРИФИКАЦИЯ: вызовы по авто платные — всё обёрнуто в 24-часовой кэш
 * (lib/laximo/cache), «1 VIN = 1 запрос в сутки».
 */

const LOCALE = "ru_RU";

export type CatalogMode = "quick" | "cat";

type Row = {
  quickgroupid?: string | number;
  link?: string;
  name?: string;
  row?: Row | Row[];
};
type Attr = { key?: string; name?: string; value?: string };
type Rec = Record<string, unknown>;

const normVin = (vin: string) => vin.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

/** Ошибка «операция не разрешена для каталога» → повод переключить режим. */
function isNotPermitted(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e);
  return /not permitted|e_accessdenied/i.test(m);
}

// ── Поиск авто по VIN ───────────────────────────────────────────────────────
async function carInfo(vin: string): Promise<GoodvinCarInfo[]> {
  return laximoCached(`vin:${normVin(vin)}`, async () => {
    const resp = await laximoQuery(
      "oem",
      `FindVehicleByVIN:Locale=${LOCALE}|VIN=${vin}|Localized=true`
    );
    const rows = asArray(
      (resp as { FindVehicleByVIN?: { row?: unknown } }).FindVehicleByVIN?.row
    ) as Rec[];

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

// ── Дерево узлов ────────────────────────────────────────────────────────────

/** Дерево в режиме QuickGroup (нативно вложенное). */
async function quickTree(
  catalogId: string,
  carId: string,
  ssd: string
): Promise<GoodvinGroupNode[]> {
  const resp = await laximoQuery(
    "oem",
    `ListQuickGroup:Locale=${LOCALE}|Catalog=${catalogId}|VehicleId=${carId}|ssd=${ssd}`
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

/** Дерево в режиме категорий (плоский список с parentcategoryid → строим дерево).
 *  Лист = категория без подкатегорий (childrens=false), у неё есть узлы. */
async function categoryTree(
  catalogId: string,
  carId: string,
  ssd: string
): Promise<GoodvinGroupNode[]> {
  const resp = await laximoQuery(
    "oem",
    `ListCategories:Locale=${LOCALE}|Catalog=${catalogId}|VehicleId=${carId}|ssd=${ssd}`
  );
  const rows = asArray(
    (resp as { ListCategories?: { row?: unknown } }).ListCategories?.row
  ) as Rec[];

  const map = new Map<string, GoodvinGroupNode>();
  const parentOf = new Map<string, string>();
  for (const r of rows) {
    const id = String(r.categoryid ?? "");
    if (!id) continue;
    map.set(id, {
      id,
      name: String(r.name ?? ""),
      hasParts: String(r.childrens) === "false",
      ssd: String(r.ssd ?? ""),
      children: [],
    });
    parentOf.set(id, String(r.parentcategoryid ?? ""));
  }
  const roots: GoodvinGroupNode[] = [];
  for (const [id, node] of map) {
    const p = parentOf.get(id);
    if (p && map.has(p)) map.get(p)!.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Полное дерево + режим. Пробуем QuickGroup, при запрете — категории. Кэш 24ч. */
async function getTree(
  catalogId: string,
  opts: { carId: string; criteria?: string }
): Promise<{ mode: CatalogMode; tree: GoodvinGroupNode[] }> {
  const result = await laximoCached<
    { mode: CatalogMode; tree: GoodvinGroupNode[] } | GoodvinGroupNode[]
  >(`tree:${catalogId}:${opts.carId}`, async () => {
    const ssd = opts.criteria ?? "";
    try {
      const tree = await quickTree(catalogId, opts.carId, ssd);
      return { mode: "quick" as const, tree };
    } catch (e) {
      if (!isNotPermitted(e)) throw e;
      const tree = await categoryTree(catalogId, opts.carId, ssd);
      return { mode: "cat" as const, tree };
    }
  });
  // Старый формат кэша (bare-массив узлов, до появления mode) → оборачиваем,
  // чтобы ранее закэшированные авто не отдавали пустое дерево.
  return Array.isArray(result) ? { mode: "quick", tree: result } : result;
}

// ── Детали узла ─────────────────────────────────────────────────────────────

function mapDetail(d: Rec): GoodvinPart {
  return {
    id: String(d.oem ?? d.codeonimage ?? d.name ?? ""),
    nameId: "",
    name: String(d.name ?? ""),
    number: String(d.oem ?? ""),
    positionNumber: d.codeonimage != null ? String(d.codeonimage) : undefined,
  };
}

/** Карта выносок узла (ListImageMapByUnit): row(code,x1,y1,x2,y2) → [x,y,w,h]. */
async function unitImageMap(
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
    ) as Rec[];
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

type Unit = { name: string; code: string; img?: string; parts: GoodvinPart[]; positions: GoodvinPartPosition[] };

function finalizeParts(units: Unit[]): GoodvinParts {
  const partGroups = units.map((u) => ({
    name: u.name,
    number: u.code,
    positionNumber: "",
    img: u.img,
    imgDescription: u.name || undefined,
    positions: u.positions,
    parts: u.parts,
  }));
  const first = partGroups.find((g) => g.img) ?? partGroups[0];
  return {
    img: first?.img,
    imgDescription: first?.imgDescription,
    partGroups,
    positions: first?.positions ?? [],
  };
}

/** Детали узла в режиме QuickGroup (ListQuickDetail: Category > Unit > Detail). */
async function quickParts(
  catalogId: string,
  carId: string,
  groupId: string,
  ssd: string
): Promise<GoodvinParts> {
  const resp = await laximoQuery(
    "oem",
    `ListQuickDetail:Locale=${LOCALE}|Catalog=${catalogId}|VehicleId=${carId}|QuickGroupId=${groupId}|ssd=${ssd}|Localized=true|All=1`
  );
  const cats = asArray(
    (resp as { ListQuickDetail?: { Category?: unknown } }).ListQuickDetail
      ?.Category
  ) as Rec[];
  const rawUnits = cats.flatMap((c) => asArray(c.Unit)) as Rec[];

  const units = await Promise.all(
    rawUnits.map(async (u): Promise<Unit> => {
      const positions =
        u.unitid && u.ssd
          ? await unitImageMap(catalogId, carId, String(u.unitid), String(u.ssd))
          : [];
      return {
        name: String(u.name ?? ""),
        code: String(u.code ?? ""),
        img: laximoImage(u.imageurl as string | undefined),
        positions,
        parts: (asArray(u.Detail) as Rec[]).map(mapDetail),
      };
    })
  );
  return finalizeParts(units);
}

/** Детали узла в режиме категорий: ListUnits(категория) → на каждый узел
 *  ListDetailByUnit + ListImageMapByUnit (ssd СВОЙ у категории и у каждого узла). */
async function categoryParts(
  catalogId: string,
  carId: string,
  categoryId: string,
  categorySsd: string
): Promise<GoodvinParts> {
  const resp = await laximoQuery(
    "oem",
    `ListUnits:Locale=${LOCALE}|Catalog=${catalogId}|VehicleId=${carId}|CategoryId=${categoryId}|ssd=${categorySsd}`
  );
  const rawUnits = asArray(
    (resp as { ListUnits?: { row?: unknown } }).ListUnits?.row
  ) as Rec[];

  const units = await Promise.all(
    rawUnits.map(async (u): Promise<Unit> => {
      const uid = String(u.unitid ?? "");
      const ussd = String(u.ssd ?? "");
      const [parts, positions] = await Promise.all([
        listDetailsByUnit(catalogId, carId, uid, ussd),
        uid && ussd ? unitImageMap(catalogId, carId, uid, ussd) : Promise.resolve([]),
      ]);
      return {
        name: String(u.name ?? ""),
        code: String(u.code ?? ""),
        img: laximoImage(u.imageurl as string | undefined),
        positions,
        parts,
      };
    })
  );
  return finalizeParts(units);
}

async function listDetailsByUnit(
  catalogId: string,
  carId: string,
  unitId: string,
  ssd: string
): Promise<GoodvinPart[]> {
  const resp = await laximoQuery(
    "oem",
    `ListDetailByUnit:Locale=${LOCALE}|Catalog=${catalogId}|VehicleId=${carId}|UnitId=${unitId}|ssd=${ssd}|Localized=true`
  );
  const rows = asArray(
    (resp as { ListDetailsByUnit?: { row?: unknown } }).ListDetailsByUnit?.row
  ) as Rec[];
  return rows.map(mapDetail);
}

/** Детали узла. mode="cat" → категории/узлы (criteria = ssd категории),
 *  иначе QuickGroup (criteria = ssd авто). Кэш 24ч. */
async function getParts(
  catalogId: string,
  opts: { carId: string; groupId: string; criteria?: string; mode?: CatalogMode }
): Promise<GoodvinParts> {
  const mode: CatalogMode = opts.mode === "cat" ? "cat" : "quick";
  return laximoCached(
    `parts:${catalogId}:${opts.carId}:${mode}:${opts.groupId}`,
    async () =>
      mode === "cat"
        ? categoryParts(catalogId, opts.carId, opts.groupId, opts.criteria ?? "")
        : quickParts(catalogId, opts.carId, opts.groupId, opts.criteria ?? "")
  );
}

// ── Поиск детали по названию/номеру ─────────────────────────────────────────
async function searchParts(
  catalogId: string,
  opts: { carId: string; criteria?: string; query: string }
): Promise<Array<{ number: string; name: string }>> {
  const q = opts.query.replace(/[|=]/g, " ").trim();
  if (!q) return [];
  return laximoCached(
    `search:${catalogId}:${opts.carId}:${q.toLowerCase()}`,
    async () => {
      try {
        const resp = await laximoQuery(
          "oem",
          `SearchVehicleDetails:Locale=${LOCALE}|Catalog=${catalogId}|VehicleId=${opts.carId}|ssd=${opts.criteria ?? ""}|Query=${q}`
        );
        const rows = asArray(
          (resp as { SearchVehicleDetails?: { row?: unknown } })
            .SearchVehicleDetails?.row
        ) as Rec[];
        return rows
          .map((r) => ({
            number: String(r.oem ?? ""),
            name: String(r["#text"] ?? "").trim(),
          }))
          .filter((x) => x.number);
      } catch (e) {
        if (isNotPermitted(e)) return []; // каталог не поддерживает поиск
        throw e;
      }
    }
  );
}

// ── Кроссы/аналоги по OEM (Laximo.DOC / Aftermarket) ────────────────────────
export type LaximoCross = { brand: string; number: string; name: string };

/** Аналоги-заменители по оригинальному номеру (FindOEM в сервисе DOC/am).
 *  Возвращает список деталей других брендов, подходящих вместо оригинала.
 *  Кэш 24ч (тарификация, как у CAT). */
export async function findCrosses(
  oem: string,
  brand?: string
): Promise<LaximoCross[]> {
  const clean = oem.trim();
  if (!clean) return [];
  const b = (brand ?? "").trim();
  return laximoCached(
    `crosses:${clean.toUpperCase()}:${b.toUpperCase()}`,
    async () => {
      try {
        const resp = await laximoQuery(
          "am",
          `FindOEM:Locale=${LOCALE}|OEM=${clean}${b ? `|Brand=${b}` : ""}|Options=crosses`
        );
        const details = asArray(
          (resp as { FindOEM?: { detail?: unknown } }).FindOEM?.detail
        ) as Rec[];
        const out: LaximoCross[] = [];
        const seen = new Set<string>();
        for (const d of details) {
          const reps = asArray((d.replacements as Rec | undefined)?.replacement) as Rec[];
          for (const rep of reps) {
            const rd = (rep.detail ?? rep) as Rec;
            const number = String(rd.formattedoem ?? rd.oem ?? "").trim();
            const mfr = String(rd.manufacturer ?? "").trim();
            if (!number) continue;
            const key = `${mfr}|${number}`.toUpperCase();
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ brand: mfr, number, name: String(rd.name ?? "").trim() });
          }
        }
        return out;
      } catch (e) {
        if (isNotPermitted(e)) return [];
        throw e;
      }
    }
  );
}

/** По форме совпадает с объектом `goodvin` — роуты подключают вместо него. */
export const laximo = {
  carInfo: (q: string, _catalogs?: string) => carInfo(q),
  getTree,
  getParts,
  searchParts,
};

export type LaximoCatalog = typeof laximo;

// LaximoError используется для типобезопасности импорта (иначе tree-shaking).
export { LaximoError };
