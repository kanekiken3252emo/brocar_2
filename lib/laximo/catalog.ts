import "server-only";
import { createHash } from "crypto";
import { laximoQuery, asArray, laximoImage, LaximoError } from "./client";
import { laximoCached, laximoDailyBudget } from "./cache";
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

/**
 * Короткий хэш ssd для ключей кэша. КРИТИЧНО: у каталогов PSA (Citroën/
 * Peugeot) vehicleid=0 у ВСЕХ авто и unitid=0 у ВСЕХ узлов — идентичность
 * живёт только в ssd. Ключ без ssd коллапсирует в один на все узлы/авто:
 * так «Свечи зажигания» отдавали закэшированные детали масляного фильтра.
 */
const ssdKey = (ssd: string | undefined) =>
  createHash("md5").update(ssd ?? "").digest("hex").slice(0, 16);

/** Ошибка «операция не разрешена для каталога» → повод переключить режим. */
function isNotPermitted(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e);
  return /not permitted|e_accessdenied/i.test(m);
}

// Латинские двойники → кириллица: гос номера в Laximo кириллические, а вводят
// их часто латиницей (T500CO66 → Т500СО66).
const PLATE_LAT2CYR: Record<string, string> = {
  A: "А", B: "В", E: "Е", K: "К", M: "М", H: "Н",
  O: "О", P: "Р", C: "С", T: "Т", Y: "У", X: "Х",
};
function normalizePlate(p: string): string {
  return p
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[A-Z]/g, (c) => PLATE_LAT2CYR[c] ?? c);
}

/** Строка авто из ответа Laximo → GoodvinCarInfo (общая для VIN и гос номера). */
function mapVehicleRow(r: Rec, vin: string): GoodvinCarInfo {
  const attrs = asArray(r.attribute) as Attr[];
  return {
    title: [r.brand, r.name].filter(Boolean).join(" "),
    catalogId: String(r.catalog ?? ""),
    brand: String(r.brand ?? ""),
    modelId: String(r.catalog ?? ""),
    carId: String(r.vehicleid ?? ""),
    criteria: String(r.ssd ?? ""),
    vin: vin || String(r.vin ?? ""),
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
    return rows.map((r) => mapVehicleRow(r, vin));
  });
}

/** Поиск авто по ГОС НОМЕРУ (FindVehicleByPlateNumber). Форма ответа как у
 *  carInfo — каталог строится по catalog+vehicleid+ssd, VIN не нужен. */
async function carInfoByPlate(plate: string): Promise<GoodvinCarInfo[]> {
  const p = normalizePlate(plate);
  if (!p) return [];
  return laximoCached(`plate:${p}`, async () => {
    const resp = await laximoQuery(
      "oem",
      `FindVehicleByPlateNumber:Locale=${LOCALE}|PlateNumber=${p}|CountryCode=ru|Localized=true`
    );
    const rows = asArray(
      (resp as { FindVehicleByPlateNumber?: { row?: unknown } })
        .FindVehicleByPlateNumber?.row
    ) as Rec[];
    return rows.map((r) => mapVehicleRow(r, String(r.vin ?? "")));
  });
}

/** Поиск авто по НОМЕРУ КУЗОВА (FindVehicleByFrame) — основной способ для
 *  японских авто без VIN (Toyota AGH30-0115914, Nissan QG10-015252…).
 *  Формат «серия-номер»: до дефиса Frame, после — FrameNo. */
async function carInfoByFrame(frameFull: string): Promise<GoodvinCarInfo[]> {
  const clean = frameFull.trim().toUpperCase().replace(/\s+/g, "");
  const m = clean.match(/^([A-Z0-9]+)-(\d+)$/);
  if (!m) return [];
  return laximoCached(`frame:${clean}`, async () => {
    const resp = await laximoQuery(
      "oem",
      `FindVehicleByFrame:Locale=${LOCALE}|Frame=${m[1]}|FrameNo=${m[2]}|Localized=true`
    );
    const rows = asArray(
      (resp as { FindVehicleByFrame?: { row?: unknown } }).FindVehicleByFrame
        ?.row
    ) as Rec[];
    return rows.map((r) => ({
      ...mapVehicleRow(r, String(r.vin ?? "")),
      frame: clean,
    }));
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
  >(`tree:${catalogId}:${opts.carId}:${ssdKey(opts.criteria)}`, async () => {
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
  // Атрибуты детали (примечание, количество, период, применимость) — для
  // подсказки-ⓘ, как в демо-витрине Laximo.
  const attributes = (asArray(d.attribute) as Attr[])
    .map((a) => ({
      key: String(a.key ?? ""),
      name: String(a.name ?? a.key ?? ""),
      value: String(a.value ?? ""),
    }))
    .filter((a) => a.value);
  return {
    id: String(d.oem ?? d.codeonimage ?? d.name ?? ""),
    nameId: "",
    name: String(d.name ?? ""),
    number: String(d.oem ?? ""),
    positionNumber: d.codeonimage != null ? String(d.codeonimage) : undefined,
    attributes: attributes.length ? attributes : undefined,
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

type Unit = {
  name: string;
  code: string;
  img?: string;
  parts: GoodvinPart[];
  positions: GoodvinPartPosition[];
  unitId?: string;
  unitSsd?: string;
};

function finalizeParts(units: Unit[]): GoodvinParts {
  const partGroups = units.map((u) => ({
    name: u.name,
    number: u.code,
    positionNumber: "",
    img: u.img,
    imgDescription: u.name || undefined,
    positions: u.positions,
    parts: u.parts,
    unitId: u.unitId,
    unitSsd: u.unitSsd,
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
        // Быстрая группа отдаёт лишь «свои» детали узла (напр., только фильтр).
        // id+ssd узла позволяют клиенту догрузить полный список деталей.
        unitId: u.unitid != null ? String(u.unitid) : undefined,
        unitSsd: u.ssd != null ? String(u.ssd) : undefined,
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
  // parts2 (не parts): в ответ добавились unitId/unitSsd — старые кэш-записи
  // без них прятали бы кнопку «Все детали узла» до истечения 24ч. ssd в ключе
  // обязателен (см. ssdKey): у PSA carId=0 у всех модификаций каталога.
  return laximoCached(
    `parts3:${catalogId}:${opts.carId}:${mode}:${opts.groupId}:${ssdKey(opts.criteria)}`,
    async () =>
      mode === "cat"
        ? categoryParts(catalogId, opts.carId, opts.groupId, opts.criteria ?? "")
        : quickParts(catalogId, opts.carId, opts.groupId, opts.criteria ?? "")
  );
}

/** ВСЕ детали узла (а не только вошедшие в быструю группу — там, например,
 *  группа «Фильтр масляный» содержит один фильтр, хотя на схеме 14 позиций).
 *  Кэш 24ч. */
async function getUnitParts(
  catalogId: string,
  opts: { carId: string; unitId: string; ssd: string }
): Promise<GoodvinPart[]> {
  return laximoCached(
    // ssd в ключе ОБЯЗАТЕЛЕН: у PSA unitId=0 у всех узлов — без ssd ключ один
    // на все узлы, и «Свечи зажигания» отдавали детали масляного фильтра.
    `unitparts2:${catalogId}:${opts.carId}:${opts.unitId}:${ssdKey(opts.ssd)}`,
    () => listDetailsByUnit(catalogId, opts.carId, opts.unitId, opts.ssd)
  );
}

// ── Режим «Все схемы» (как у Армтек): категории → узлы с превью схем ────────

export type LaximoUnit = {
  unitId: string;
  code: string;
  name: string;
  /** Превью схемы для плитки. */
  img?: string;
  /** Полноразмерная схема для просмотра узла. */
  largeImg?: string;
  ssd: string;
};

/** Категории каталога (для «Всех схем»). Работает и у quick-каталогов —
 *  ListCategories доступен почти везде. Кэш 24ч. */
async function getCategories(
  catalogId: string,
  opts: { carId: string; criteria?: string }
): Promise<GoodvinGroupNode[]> {
  return laximoCached(
    `cats:${catalogId}:${opts.carId}:${ssdKey(opts.criteria)}`,
    () => categoryTree(catalogId, opts.carId, opts.criteria ?? "")
  );
}

/** Узлы категории со схемами-превью (ListUnits). Кэш 24ч. */
async function getUnits(
  catalogId: string,
  opts: { carId: string; categoryId: string; criteria?: string }
): Promise<LaximoUnit[]> {
  return laximoCached(
    `units:${catalogId}:${opts.carId}:${opts.categoryId}:${ssdKey(opts.criteria)}`,
    async () => {
      const resp = await laximoQuery(
        "oem",
        `ListUnits:Locale=${LOCALE}|Catalog=${catalogId}|VehicleId=${opts.carId}|CategoryId=${opts.categoryId}|ssd=${opts.criteria ?? ""}`
      );
      const rows = asArray(
        (resp as { ListUnits?: { row?: unknown } }).ListUnits?.row
      ) as Rec[];
      return rows.map((u) => ({
        unitId: String(u.unitid ?? ""),
        code: String(u.code ?? ""),
        name: String(u.name ?? ""),
        img: laximoImage(u.imageurl as string | undefined, "250"),
        largeImg: laximoImage(u.imageurl as string | undefined),
        ssd: String(u.ssd ?? ""),
      }));
    }
  );
}

/** Узел целиком для «Всех схем»: детали + карта выносок. Кэш 24ч. */
async function getUnitView(
  catalogId: string,
  opts: { carId: string; unitId: string; ssd: string }
): Promise<{ parts: GoodvinPart[]; positions: GoodvinPartPosition[] }> {
  return laximoCached(
    `unitview2:${catalogId}:${opts.carId}:${opts.unitId}:${ssdKey(opts.ssd)}`,
    async () => {
      const [parts, positions] = await Promise.all([
        listDetailsByUnit(catalogId, opts.carId, opts.unitId, opts.ssd),
        unitImageMap(catalogId, opts.carId, opts.unitId, opts.ssd),
      ]);
      return { parts, positions };
    }
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
    `search:${catalogId}:${opts.carId}:${ssdKey(opts.criteria)}:${q.toLowerCase()}`,
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

/** Расположение детали в авто по OEM (GetOEMPartApplicability): узлы со
 *  схемами и выносками, где встречается номер, — «фото + артикул», как у
 *  Армтек. Форма ответа как у ListQuickDetail (Category → Unit → Detail).
 *  null — каталог не поддерживает операцию или номер не найден. Кэш 24ч. */
async function searchOemLocation(
  catalogId: string,
  opts: { carId: string; criteria?: string; oem: string }
): Promise<GoodvinParts | null> {
  const oem = opts.oem.replace(/[|=]/g, " ").trim();
  if (!oem) return null;
  // ОБЁРТКА {parts}: laximoCached не кэширует null, а «номер не нашёлся» —
  // частый ответ: без обёртки каждый повторный клик жёг бы платный
  // GetOEMPartApplicability (лимит OEM всего 500/мес).
  const wrapped = await laximoCached<{ parts: GoodvinParts | null }>(
    `oemloc2:${catalogId}:${opts.carId}:${ssdKey(opts.criteria)}:${oem.toUpperCase()}`,
    async () => {
      let resp: Rec;
      try {
        resp = await laximoQuery(
          "oem",
          `GetOEMPartApplicability:Locale=${LOCALE}|Catalog=${catalogId}|ssd=${opts.criteria ?? ""}|OEM=${oem}`
        );
      } catch (e) {
        if (isNotPermitted(e)) return { parts: null };
        throw e;
      }
      // Имя корневого элемента у операции не зафиксировано в доке — берём
      // первый узел ответа, внутри которого есть Category.
      const root = Object.values(resp).find(
        (v): v is Rec =>
          typeof v === "object" && v !== null && "Category" in (v as Rec)
      );
      const cats = asArray(root?.Category) as Rec[];
      const rawUnits = cats.flatMap((c) => asArray(c.Unit)) as Rec[];
      if (!rawUnits.length) return { parts: null };

      const units = await Promise.all(
        rawUnits.map(async (u): Promise<Unit> => {
          const positions =
            u.unitid && u.ssd
              ? await unitImageMap(
                  catalogId,
                  opts.carId,
                  String(u.unitid),
                  String(u.ssd)
                )
              : [];
          return {
            name: String(u.name ?? ""),
            code: String(u.code ?? ""),
            img: laximoImage(u.imageurl as string | undefined),
            positions,
            parts: (asArray(u.Detail) as Rec[]).map(mapDetail),
            unitId: u.unitid != null ? String(u.unitid) : undefined,
            unitSsd: u.ssd != null ? String(u.ssd) : undefined,
          };
        })
      );
      return { parts: finalizeParts(units) };
    }
  );
  return wrapped.parts;
}

// ── Выбор авто без VIN: марка → мастер параметров → список авто ────────────
// (как на главной демо-витрины Laximo: список марок A–Z и «поиск по параметрам»)

export type LaximoBrand = {
  code: string;
  brand: string;
  name: string;
  /** Каталог поддерживает подбор по параметрам (feature wizardsearch2). */
  wizard: boolean;
};

export type WizardStep = {
  conditionId: string;
  name: string; // «Модель», «Год выпуска», «Двигатель»…
  determined: boolean; // шаг уже выбран (value заполнен)
  value?: string;
  options: Array<{ key: string; label: string }>; // key = новый ssd после выбора
};

/** Все доступные каталоги-марки (ListCatalogs). Кэш 24ч — список статичный. */
async function listBrands(): Promise<LaximoBrand[]> {
  return laximoCached("catalogs:all", async () => {
    const resp = await laximoQuery("oem", `ListCatalogs:Locale=${LOCALE}`);
    const rows = asArray(
      (resp as { ListCatalogs?: { row?: unknown } }).ListCatalogs?.row
    ) as Rec[];
    return rows
      .map((r) => {
        const feats = asArray(
          (r.features as Rec | undefined)?.feature
        ) as Rec[];
        return {
          code: String(r.code ?? ""),
          brand: String(r.brand ?? r.name ?? ""),
          name: String(r.name ?? r.brand ?? ""),
          wizard: feats.some((f) => String(f.name) === "wizardsearch2"),
        };
      })
      .filter((b) => b.code)
      .sort((a, b) => a.name.localeCompare(b.name, "en"));
  });
}

/** Шаги мастера подбора авто по параметрам (GetWizard2). Выбор опции даёт
 *  новый ssd → повторный вызов с ним возвращает уточнённые шаги. */
async function getWizard(catalogId: string, ssd = ""): Promise<WizardStep[]> {
  return laximoCached(`wizard:${catalogId}:${ssdKey(ssd)}`, async () => {
    const resp = await laximoQuery(
      "oem",
      `GetWizard2:Locale=${LOCALE}|Catalog=${catalogId}|ssd=${ssd}`
    );
    const rows = asArray(
      (resp as { GetWizard2?: { row?: unknown } }).GetWizard2?.row
    ) as Rec[];
    return rows.map((r): WizardStep => {
      const opts = asArray((r.options as Rec | undefined)?.row) as Rec[];
      return {
        conditionId: String(r.conditionid ?? r.name ?? ""),
        name: String(r.name ?? ""),
        determined: String(r.determined) === "true",
        value: r.value != null && r.value !== "" ? String(r.value) : undefined,
        options: opts
          .map((o) => ({ key: String(o.key ?? ""), label: String(o.value ?? "") }))
          .filter((o) => o.key),
      };
    });
  });
}

/** Автомобили, подходящие под выбранные в мастере параметры. */
async function findByWizard(
  catalogId: string,
  ssd: string
): Promise<GoodvinCarInfo[]> {
  if (!ssd) return [];
  return laximoCached(`wizardcars:${catalogId}:${ssdKey(ssd)}`, async () => {
    const resp = await laximoQuery(
      "oem",
      `FindVehicleByWizard2:Locale=${LOCALE}|Catalog=${catalogId}|ssd=${ssd}|Localized=true`
    );
    const rows = asArray(
      (resp as { FindVehicleByWizard2?: { row?: unknown } })
        .FindVehicleByWizard2?.row
    ) as Rec[];
    return rows.map((r) => mapVehicleRow(r, ""));
  });
}

// ── Кроссы/аналоги по OEM (Laximo.DOC / Aftermarket) ────────────────────────
export type LaximoCross = { brand: string; number: string; name: string };

/** Аналоги-заменители по оригинальному номеру (FindOEM в сервисе DOC/am).
 *  Возвращает список деталей других брендов, подходящих вместо оригинала.
 *  Кэш 24ч (тарификация, как у CAT). */
export async function findCrosses(
  oem: string,
  _brand?: string // бренд НЕ передаём в Laximo — он сужает выдачу (Армтек ищет
  // просто по номеру и находит больше). Параметр оставлен для совместимости.
): Promise<LaximoCross[]> {
  const clean = oem.trim();
  if (!clean) return [];
  // ОБЁРТКА {crosses}: laximoCached не кэширует пустые массивы, а у большинства
  // артикулов-аналогов кроссов НЕТ → каждый просмотр карточки жёг платный
  // FindOEM заново (лимит DOC 10000/мес улетал за сутки). Объект кэшируется
  // всегда — «пусто» тоже 1 запрос в сутки.
  const wrapped = await laximoCached<{ crosses: LaximoCross[] }>(
    `crosses2:${clean.toUpperCase()}`,
    async () => {
      // Предохранитель: не больше 250 живых FindOEM в сутки (лимит DOC
      // 10000/мес). Сверх бюджета отдаём «пока пусто» БЕЗ кэширования —
      // завтра артикул попробуется снова.
      if (!(await laximoDailyBudget("findoem", 250))) {
        throw new LaximoError("Дневной бюджет каталога аналогов исчерпан");
      }
      try {
        const resp = await laximoQuery(
          "am",
          `FindOEM:Locale=${LOCALE}|OEM=${clean}|Options=crosses`
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
        return { crosses: out };
      } catch (e) {
        if (isNotPermitted(e)) return { crosses: [] };
        throw e;
      }
    }
  );
  return wrapped.crosses;
}

/** По форме совпадает с объектом `goodvin` — роуты подключают вместо него. */
export const laximo = {
  carInfo: (q: string, _catalogs?: string) => carInfo(q),
  carInfoByPlate,
  carInfoByFrame,
  getTree,
  getParts,
  getUnitParts,
  getCategories,
  getUnits,
  getUnitView,
  searchParts,
  searchOemLocation,
  listBrands,
  getWizard,
  findByWizard,
};

export type LaximoCatalog = typeof laximo;

// LaximoError используется для типобезопасности импорта (иначе tree-shaking).
export { LaximoError };
