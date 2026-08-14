"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Search,
  Loader2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Car,
  Package,
  Tag,
  FolderTree,
  MousePointerClick,
  Maximize2,
  ZoomIn,
  ZoomOut,
  X,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  GoodvinCarInfo,
  GoodvinGroupNode,
  GoodvinPart,
  GoodvinPartPosition,
  GoodvinParts,
} from "@/types/goodvin";

/** Протокол-относительные ссылки картинок → https. */
function img(src?: string): string | undefined {
  if (!src) return undefined;
  return src.startsWith("//") ? `https:${src}` : src;
}

/**
 * Ключ в sessionStorage для запоминания позиции в каталоге (авто + выбранный
 * узел). Нужно, чтобы «Назад» из карточки цен возвращала на ту же схему.
 */
const NAV_STORAGE_KEY = "vinCatalogNav";

type CatalogMode = "quick" | "cat";

// ── Выбор авто без VIN: марка → мастер параметров (как в демо Laximo) ───────
type BrandItem = { code: string; brand: string; name: string; wizard: boolean };

type WizardStep = {
  conditionId: string;
  name: string;
  determined: boolean;
  value?: string;
  options: Array<{ key: string; label: string }>;
};

type WizardState = {
  catalog: BrandItem;
  ssd: string;
  steps: WizardStep[];
};

// ── Режим «Все схемы» (как у Армтек): категории → плитка узлов с превью ─────
type SchemeUnit = {
  unitId: string;
  code: string;
  name: string;
  img?: string;
  largeImg?: string;
  ssd: string;
};

interface SavedNav {
  query: string;
  car: GoodvinCarInfo;
  mode: CatalogMode;
  leaf: { id: string; name: string; ssd?: string } | null;
  /** Одноразовая передача машины (виджет подбора на главной): восстановить
   *  один раз даже без параметров в URL. При обычном заходе без параметров
   *  прошлую машину НЕ восстанавливаем — юзеру проще искать другую. */
  handoff?: boolean;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      data?.error || data?.upstream?.message || "Ошибка запроса к каталогу"
    );
  }
  return data as T;
}

/** Переводит технические ошибки Laximo в понятные покупателю сообщения. */
function friendlyVinError(msg: string): string {
  if (/E_INVALIDPARAMETER:VIN|invalid.*vin/i.test(msg))
    return "Неверный VIN. Проверьте, что вы ввели все 17 символов номера без ошибок.";
  if (/E_ACCESSDENIED|not permitted/i.test(msg))
    return "Каталог для этого автомобиля временно недоступен. Напишите нам — подберём вручную.";
  return "Не удалось найти автомобиль по этому номеру. Проверьте VIN и попробуйте снова.";
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-neutral-400">
      <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/** Полноэкранное «рабочее место» узла (как у Армтек): большая схема с зумом
 *  слева + список деталей справа (на мобилке — снизу). Выноски кликабельны:
 *  тап по номеру подсвечивает деталь в списке и подскролливает к ней; клик
 *  по строке — подсвечивает выноску. */
function UnitLightbox({
  src,
  alt,
  positions = [],
  parts,
  backVin,
  fromBrand,
  onClose,
}: {
  src: string;
  alt: string;
  positions?: GoodvinPartPosition[];
  parts: GoodvinPart[];
  backVin?: string;
  fromBrand?: string;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [active, setActive] = useState<string | null>(null);
  // Открытая подсказка-ⓘ (индекс детали) — как в обычном списке.
  const [infoOpen, setInfoOpen] = useState<number | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Блокируем прокрутку страницы под оверлеем.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const zoom = (dir: 1 | -1) =>
    setScale((s) => Math.min(4, Math.max(1, +(s + dir * 0.5).toFixed(1))));

  const pick = (num: string) => {
    setActive((prev) => (prev === num ? null : num));
    rowRefs.current[num]?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-neutral-950">
      {/* Шапка: название узла + зум + закрыть */}
      <div className="flex items-center gap-2 border-b border-neutral-800 p-3">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
          {alt}
        </p>
        <button
          type="button"
          onClick={() => zoom(-1)}
          disabled={scale <= 1}
          className="rounded-xl bg-neutral-800 p-2.5 text-white transition-colors hover:bg-neutral-700 disabled:opacity-40"
          title="Уменьшить"
        >
          <ZoomOut className="h-5 w-5" />
        </button>
        <span className="min-w-[3.5rem] text-center font-mono text-sm text-neutral-300">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={() => zoom(1)}
          disabled={scale >= 4}
          className="rounded-xl bg-neutral-800 p-2.5 text-white transition-colors hover:bg-neutral-700 disabled:opacity-40"
          title="Увеличить"
        >
          <ZoomIn className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="ml-1 rounded-xl bg-orange-500 p-2.5 text-white transition-colors hover:bg-orange-600"
          title="Закрыть"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Схема (белая подложка — схемы Laximo под белый фон) */}
        <div className="min-h-0 flex-1 overflow-auto p-2">
          <div
            className="relative mx-auto rounded-xl bg-white"
            style={{
              width: `${scale * 100}%`,
              maxWidth: scale === 1 ? 1400 : undefined,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="block h-auto w-full select-none"
              onDoubleClick={() => setScale((s) => (s > 1 ? 1 : 2.5))}
              onLoad={(e) =>
                setDims({
                  w: e.currentTarget.naturalWidth,
                  h: e.currentTarget.naturalHeight,
                })
              }
              draggable={false}
            />
            {dims &&
              positions.map((pos) => {
                const c = pos.coordinates;
                if (!c || c.length < 4) return null;
                const PAD = 7;
                const x = Math.max(0, c[0] - PAD);
                const y = Math.max(0, c[1] - PAD);
                const isActive = active === pos.number;
                return (
                  <button
                    key={`${pos.number}-${x}-${y}`}
                    type="button"
                    onClick={() => pick(pos.number)}
                    title={`Позиция ${pos.number}`}
                    style={{
                      left: `${(x / dims.w) * 100}%`,
                      top: `${(y / dims.h) * 100}%`,
                      width: `${((c[2] + PAD * 2) / dims.w) * 100}%`,
                      height: `${((c[3] + PAD * 2) / dims.h) * 100}%`,
                    }}
                    className={`absolute cursor-pointer rounded-md border transition-all ${
                      isActive
                        ? "border-orange-500 bg-orange-500/40 ring-2 ring-orange-500/30"
                        : "border-orange-400/70 bg-orange-400/15 hover:border-orange-500 hover:bg-orange-500/30"
                    }`}
                  />
                );
              })}
          </div>
        </div>

        {/* Детали узла: справа на десктопе, снизу на мобилке */}
        <div className="h-[38vh] shrink-0 overflow-y-auto border-t border-neutral-800 lg:h-auto lg:w-[380px] lg:border-l lg:border-t-0">
          <div className="divide-y divide-neutral-800">
            {parts.map((part, pi) => {
              const pos = part.positionNumber || "";
              const isActive = pos !== "" && active === pos;
              return (
                <div
                  key={`${part.id}-${pi}`}
                  ref={(el) => {
                    if (pos) rowRefs.current[pos] = el;
                  }}
                  onClick={() => pos && setActive(pos)}
                  className={`p-2.5 transition-colors ${
                    pos ? "cursor-pointer" : ""
                  } ${
                    isActive
                      ? "bg-orange-500/10 ring-1 ring-inset ring-orange-500/50"
                      : "hover:bg-neutral-800/40"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {pos && (
                      <span
                        className={`flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md px-1.5 text-xs font-bold ${
                          isActive
                            ? "bg-orange-500 text-white"
                            : "bg-orange-500/15 text-orange-400"
                        }`}
                      >
                        {pos}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-neutral-100">
                        {part.name}
                      </p>
                      {part.number && (
                        <p className="font-mono text-xs text-neutral-400">
                          {part.number}
                        </p>
                      )}
                    </div>
                    {!!part.attributes?.length && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInfoOpen((v) => (v === pi ? null : pi));
                        }}
                        title="Информация о детали"
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
                          infoOpen === pi
                            ? "border-orange-500 bg-orange-500 text-white"
                            : "border-neutral-700 text-neutral-400 hover:border-orange-500 hover:text-orange-400"
                        }`}
                      >
                        <Info className="h-4 w-4" />
                      </button>
                    )}
                    {part.number && (
                      <Link
                        href={`/catalog?article=${encodeURIComponent(
                          part.number
                        )}${
                          backVin
                            ? `&fromVin=${encodeURIComponent(backVin)}`
                            : ""
                        }${
                          fromBrand
                            ? `&fromBrand=${encodeURIComponent(fromBrand)}`
                            : ""
                        }`}
                        className="shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button size="sm" variant="outline" className="gap-1.5">
                          <Tag className="h-3.5 w-3.5" />
                          Цены
                        </Button>
                      </Link>
                    )}
                  </div>
                  {infoOpen === pi && !!part.attributes?.length && (
                    <div
                      className="mt-2 space-y-1 rounded-lg border border-neutral-800 bg-neutral-950/60 p-2.5 text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {part.attributes.map((a) => (
                        <p key={a.key}>
                          <span className="text-neutral-500">
                            {attrLabel(a)}:{" "}
                          </span>
                          <span className="text-neutral-200">{a.value}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
      <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
      <span>{message}</span>
    </div>
  );
}

/** Совпадает ли узел или кто-то из потомков с фильтром по названию. */
function nodeMatches(node: GoodvinGroupNode, q: string): boolean {
  if (!q) return true;
  if (node.name.toLowerCase().includes(q)) return true;
  return node.children.some((c) => nodeMatches(c, q));
}

/** Один узел дерева (рекурсивно). Ветка раскрывается, лист выбирается. */
function TreeNode({
  node,
  depth,
  filter,
  expanded,
  toggle,
  selectedId,
  onSelect,
}: {
  node: GoodvinGroupNode;
  depth: number;
  filter: string;
  expanded: Set<string>;
  toggle: (id: string) => void;
  selectedId: string | null;
  onSelect: (node: GoodvinGroupNode) => void;
}) {
  const isBranch = node.children.length > 0;
  const isLeaf = !isBranch && node.hasParts;
  // При активном фильтре ветки принудительно раскрыты.
  const open = filter ? true : expanded.has(node.id);
  const pad = 8 + depth * 14;

  if (isBranch) {
    const visibleKids = node.children.filter((c) => nodeMatches(c, filter));
    return (
      <div>
        <button
          type="button"
          onClick={() => toggle(node.id)}
          style={{ paddingLeft: pad }}
          className="flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-sm text-neutral-300 hover:bg-neutral-800/60 hover:text-white transition-colors"
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
          )}
          <span className="line-clamp-2">{node.name}</span>
        </button>
        {open && (
          <div>
            {visibleKids.map((c) => (
              <TreeNode
                key={c.id}
                node={c}
                depth={depth + 1}
                filter={filter}
                expanded={expanded}
                toggle={toggle}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Лист (или пустой узел без деталей — тогда некликабельный).
  const selected = selectedId === node.id;
  return (
    <button
      type="button"
      disabled={!isLeaf}
      onClick={() => isLeaf && onSelect(node)}
      style={{ paddingLeft: pad + 20 }}
      className={`flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-sm transition-colors ${
        selected
          ? "bg-orange-500/15 text-orange-300 font-medium"
          : isLeaf
            ? "text-neutral-300 hover:bg-neutral-800/60 hover:text-white"
            : "text-neutral-600 cursor-default"
      }`}
    >
      <span className="line-clamp-2">{node.name}</span>
    </button>
  );
}

const PLATE_RE =
  /^[АВЕКМНОРСТУХABEKMHOPCTYX]\d{3}[АВЕКМНОРСТУХABEKMHOPCTYX]{2}\d{2,3}$/i;

/** Человеческие названия атрибутов детали Laximo (для подсказки-ⓘ).
 *  Некоторые приходят непереведёнными (range, applicablemodels). */
const ATTR_LABELS: Record<string, string> = {
  note: "Примечание",
  addnote: "Дополнительно",
  amount: "Количество",
  range: "Период выпуска",
  applicablemodels: "Применимость",
  applicability: "Применимость",
  replacedoem: "Заменяет номер",
};
const attrLabel = (a: { key: string; name: string }) =>
  ATTR_LABELS[a.key.toLowerCase()] || a.name || a.key;

// Номер кузова японских авто: «серия-номер» (AGH30-0115914, QG10-015252).
const FRAME_RE = /^[A-Z][A-Z0-9]{1,9}-\d{4,8}$/i;

export function VinCatalog({
  initialVin,
  initialPlate,
  initialFrame,
}: {
  initialVin?: string;
  initialPlate?: string;
  initialFrame?: string;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState<null | "cars" | "tree" | "parts">(
    null
  );
  const [error, setError] = useState("");

  const [cars, setCars] = useState<GoodvinCarInfo[]>([]);
  const [car, setCar] = useState<GoodvinCarInfo | null>(null);
  // Окно с параметрами машины (кнопка-ⓘ рядом с названием, как у Армтек).
  const [carInfoOpen, setCarInfoOpen] = useState(false);

  const [tree, setTree] = useState<GoodvinGroupNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string>("");
  const [selectedSsd, setSelectedSsd] = useState<string | undefined>(undefined);
  const [parts, setParts] = useState<GoodvinParts | null>(null);
  // Режим каталога (quick/cat) — в ref, чтобы колбэки видели актуальное значение.
  const modeRef = useRef<CatalogMode>("quick");

  // Вход без VIN: список марок и мастер подбора по параметрам.
  const [brands, setBrands] = useState<BrandItem[] | null>(null);
  const [wiz, setWiz] = useState<WizardState | null>(null);
  const [wizLoading, setWizLoading] = useState(false);

  // Режим «Все схемы»: вкладка, категории, плитка узлов, открытый узел.
  const [viewTab, setViewTab] = useState<"groups" | "schemes">("groups");
  const [cats, setCats] = useState<GoodvinGroupNode[] | null>(null);
  const [catsLoading, setCatsLoading] = useState(false);
  const [catExpanded, setCatExpanded] = useState<Set<string>>(new Set());
  const [selCatId, setSelCatId] = useState<string | null>(null);
  const [selCatName, setSelCatName] = useState("");
  const [unitsList, setUnitsList] = useState<SchemeUnit[] | null>(null);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [schemeUnit, setSchemeUnit] = useState<SchemeUnit | null>(null);
  const [schemeGroup, setSchemeGroup] = useState<
    GoodvinParts["partGroups"][number] | null
  >(null);
  const [schemeLoading, setSchemeLoading] = useState(false);

  // Поиск детали по названию/номеру внутри каталога авто.
  const [partQuery, setPartQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{
    number: string;
    name: string;
  }> | null>(null);
  const [searching, setSearching] = useState(false);
  // Выбранный результат поиска: узлы со схемами, где стоит этот OEM
  // (GetOEMPartApplicability) — «фото + артикул», как у Армтек.
  const [oemView, setOemView] = useState<{
    oem: string;
    parts: GoodvinParts | null;
  } | null>(null);
  const [oemLoading, setOemLoading] = useState<string | null>(null);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const loadTree = useCallback(async (selectedCar: GoodvinCarInfo) => {
    setLoading("tree");
    setError("");
    try {
      const data = await fetchJson<{
        tree: GoodvinGroupNode[];
        mode?: CatalogMode;
      }>(
        `/api/goodvin/tree?catalogId=${encodeURIComponent(
          selectedCar.catalogId
        )}&carId=${encodeURIComponent(
          selectedCar.carId
        )}&criteria=${encodeURIComponent(selectedCar.criteria || "")}`
      );
      modeRef.current = data.mode === "cat" ? "cat" : "quick";
      setTree(data.tree);
      // Раскрываем первую ветку — чтобы дерево не выглядело пустым.
      const first = data.tree.find((n) => n.children.length > 0);
      setExpanded(first ? new Set([first.id]) : new Set());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }, []);

  const loadParts = useCallback(
    async (
      selectedCar: GoodvinCarInfo,
      leaf: { id: string; name: string; ssd?: string }
    ) => {
      setLoading("parts");
      setError("");
      setSearchResults(null); // выбор узла в дереве убирает результаты поиска
      setOemView(null);
      setSelectedId(leaf.id);
      setSelectedName(leaf.name);
      setSelectedSsd(leaf.ssd);
      // В режиме «cat» criteria — ssd самой категории; в «quick» — ssd авто.
      const m = modeRef.current;
      const criteria =
        m === "cat"
          ? leaf.ssd || selectedCar.criteria || ""
          : selectedCar.criteria || "";
      try {
        const data = await fetchJson<{ parts: GoodvinParts }>(
          `/api/goodvin/parts?catalogId=${encodeURIComponent(
            selectedCar.catalogId
          )}&carId=${encodeURIComponent(
            selectedCar.carId
          )}&groupId=${encodeURIComponent(
            leaf.id
          )}&criteria=${encodeURIComponent(criteria)}&mode=${m}`
        );
        setParts(data.parts);
      } catch (e) {
        setError((e as Error).message);
        setParts(null);
      } finally {
        setLoading(null);
      }
    },
    []
  );

  const onSelectLeaf = useCallback(
    (node: GoodvinGroupNode) => {
      if (car)
        void loadParts(car, { id: node.id, name: node.name, ssd: node.ssd });
    },
    [car, loadParts]
  );

  // ── «Все схемы»: категории → плитка узлов со схемами → узел ───────────────
  const toggleCat = useCallback((id: string) => {
    setCatExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openSchemesTab = useCallback(async () => {
    setViewTab("schemes");
    setSearchResults(null);
    if (cats !== null || !car) return;
    setCatsLoading(true);
    setError("");
    try {
      const data = await fetchJson<{ categories: GoodvinGroupNode[] }>(
        `/api/goodvin/categories?catalogId=${encodeURIComponent(
          car.catalogId
        )}&carId=${encodeURIComponent(car.carId)}&criteria=${encodeURIComponent(
          car.criteria || ""
        )}`
      );
      setCats(data.categories);
    } catch (e) {
      setError((e as Error).message);
      setViewTab("groups");
    } finally {
      setCatsLoading(false);
    }
  }, [car, cats]);

  const selectSchemeCat = useCallback(
    async (node: GoodvinGroupNode) => {
      if (!car) return;
      setSelCatId(node.id);
      setSelCatName(node.name);
      setSchemeUnit(null);
      setSchemeGroup(null);
      setUnitsLoading(true);
      setError("");
      try {
        const data = await fetchJson<{ units: SchemeUnit[] }>(
          `/api/goodvin/units?catalogId=${encodeURIComponent(
            car.catalogId
          )}&carId=${encodeURIComponent(
            car.carId
          )}&categoryId=${encodeURIComponent(
            node.id
          )}&criteria=${encodeURIComponent(node.ssd || car.criteria || "")}`
        );
        setUnitsList(data.units);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setUnitsLoading(false);
      }
    },
    [car]
  );

  const openSchemeUnit = useCallback(
    async (u: SchemeUnit) => {
      if (!car) return;
      setSchemeUnit(u);
      setSchemeGroup(null);
      setSchemeLoading(true);
      setError("");
      try {
        const data = await fetchJson<{
          parts: GoodvinParts["partGroups"][number]["parts"];
          positions: NonNullable<
            GoodvinParts["partGroups"][number]["positions"]
          >;
        }>(
          `/api/goodvin/unit-view?catalogId=${encodeURIComponent(
            car.catalogId
          )}&carId=${encodeURIComponent(car.carId)}&unitId=${encodeURIComponent(
            u.unitId
          )}&ssd=${encodeURIComponent(u.ssd)}`
        );
        setSchemeGroup({
          name: u.name,
          number: u.code,
          positionNumber: "",
          img: u.largeImg,
          imgDescription: u.name,
          positions: data.positions,
          parts: data.parts,
        });
      } catch (e) {
        setError((e as Error).message);
        setSchemeUnit(null);
      } finally {
        setSchemeLoading(false);
      }
    },
    [car]
  );

  /** Схема узла для найденного OEM — где деталь стоит в этом авто. */
  const openOemResult = useCallback(
    async (oem: string) => {
      if (!car) return;
      setOemLoading(oem);
      setError("");
      try {
        const data = await fetchJson<{ parts: GoodvinParts | null }>(
          `/api/goodvin/search-oem?catalogId=${encodeURIComponent(
            car.catalogId
          )}&carId=${encodeURIComponent(car.carId)}&criteria=${encodeURIComponent(
            car.criteria || ""
          )}&oem=${encodeURIComponent(oem)}`
        );
        setOemView({ oem, parts: data.parts });
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setOemLoading(null);
      }
    },
    [car]
  );

  const doPartSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!car) return;
      const q = partQuery.trim();
      if (!q) {
        setSearchResults(null);
        setOemView(null);
        return;
      }
      setSearching(true);
      setError("");
      try {
        const data = await fetchJson<{
          results: Array<{ number: string; name: string }>;
        }>(
          `/api/goodvin/search?catalogId=${encodeURIComponent(
            car.catalogId
          )}&carId=${encodeURIComponent(car.carId)}&criteria=${encodeURIComponent(
            car.criteria || ""
          )}&q=${encodeURIComponent(q)}`
        );
        setSearchResults(data.results);
        setParts(null);
        setSelectedId(null);
        setOemView(null);
        // Сразу показываем схему первого варианта — как у Армтек
        // («фото + артикул» без лишнего клика).
        if (data.results.length) void openOemResult(data.results[0].number);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setSearching(false);
      }
    },
    [car, partQuery, openOemResult]
  );

  const selectCar = useCallback(
    (selectedCar: GoodvinCarInfo) => {
      setCar(selectedCar);
      setCars([]);
      setParts(null);
      setSelectedId(null);
      setSelectedName("");
      setFilter("");
      setSearchResults(null);
      setOemView(null);
      // Режим «Все схемы» — данные другого авто не переиспользуем.
      setViewTab("groups");
      setCats(null);
      setSelCatId(null);
      setUnitsList(null);
      setSchemeUnit(null);
      setSchemeGroup(null);
      void loadTree(selectedCar);
    },
    [loadTree]
  );

  // ── Мастер «марка → параметры → авто» (вход без VIN) ──────────────────────
  const loadWizard = useCallback(async (b: BrandItem, ssd: string) => {
    setWizLoading(true);
    setError("");
    try {
      const data = await fetchJson<{ steps: WizardStep[] }>(
        `/api/goodvin/wizard?catalogId=${encodeURIComponent(
          b.code
        )}&ssd=${encodeURIComponent(ssd)}`
      );
      setWiz({ catalog: b, ssd, steps: data.steps });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWizLoading(false);
    }
  }, []);

  const openBrand = useCallback(
    (b: BrandItem) => {
      setWiz({ catalog: b, ssd: "", steps: [] });
      void loadWizard(b, "");
    },
    [loadWizard]
  );

  const wizardShowCars = useCallback(async () => {
    if (!wiz?.ssd) return;
    setLoading("cars");
    setError("");
    try {
      const data = await fetchJson<{ cars: GoodvinCarInfo[] }>(
        `/api/goodvin/wizard-cars?catalogId=${encodeURIComponent(
          wiz.catalog.code
        )}&ssd=${encodeURIComponent(wiz.ssd)}`
      );
      if (!data.cars.length) {
        setError(
          "Под выбранные параметры автомобилей не нашлось. Попробуйте изменить параметры."
        );
        return;
      }
      setWiz(null);
      if (data.cars.length === 1) selectCar(data.cars[0]);
      else setCars(data.cars);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }, [wiz, selectCar]);

  // Поиск авто по ГОС НОМЕРУ (Laximo FindVehicleByPlateNumber).
  const runPlateSearch = useCallback(
    async (plate: string) => {
      const value = plate.trim();
      if (!value) return;
      try {
        sessionStorage.removeItem(NAV_STORAGE_KEY);
      } catch {}
      setLoading("cars");
      setError("");
      setCar(null);
      setCars([]);
      setParts(null);
      setSelectedId(null);
      setTree([]);
      setWiz(null);
      try {
        const data = await fetchJson<{ cars: GoodvinCarInfo[] }>(
          `/api/goodvin/car-info?plate=${encodeURIComponent(value)}`
        );
        if (!data.cars.length) {
          setError(
            "По этому гос номеру автомобиль не найден. Проверьте номер или введите VIN."
          );
          return;
        }
        if (data.cars.length === 1) selectCar(data.cars[0]);
        else setCars(data.cars);
      } catch (e) {
        setError(friendlyVinError((e as Error).message));
      } finally {
        setLoading(null);
      }
    },
    [selectCar]
  );

  // Поиск авто по НОМЕРУ КУЗОВА (японские авто без VIN: AGH30-0115914).
  const runFrameSearch = useCallback(
    async (frame: string) => {
      const value = frame.trim().toUpperCase();
      if (!value) return;
      try {
        sessionStorage.removeItem(NAV_STORAGE_KEY);
      } catch {}
      setLoading("cars");
      setError("");
      setCar(null);
      setCars([]);
      setParts(null);
      setSelectedId(null);
      setTree([]);
      setWiz(null);
      try {
        const data = await fetchJson<{ cars: GoodvinCarInfo[] }>(
          `/api/goodvin/car-info?frame=${encodeURIComponent(value)}`
        );
        if (!data.cars.length) {
          setError(
            "По этому номеру кузова автомобиль не найден. Проверьте формат: серия-номер, например AGH30-0115914."
          );
          return;
        }
        if (data.cars.length === 1) selectCar(data.cars[0]);
        else setCars(data.cars);
      } catch (e) {
        setError(friendlyVinError((e as Error).message));
      } finally {
        setLoading(null);
      }
    },
    [selectCar]
  );

  const runSearch = useCallback(
    async (q: string) => {
      const value = q.trim();
      if (!value) return;
      // Гос номер → отдельный поиск по номеру.
      const compact = value.replace(/\s+/g, "");
      if (PLATE_RE.test(compact)) {
        void runPlateSearch(compact);
        return;
      }
      // Номер кузова (с дефисом) → поиск по FRAME.
      if (FRAME_RE.test(compact)) {
        void runFrameSearch(compact);
        return;
      }
      // VIN — ровно 17 символов. Проверяем сами, чтобы клиент видел понятную
      // подсказку, а не техническую ошибку Laximo (E_INVALIDPARAMETER:VIN).
      const vin = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      if (vin.length !== 17) {
        setCar(null);
        setCars([]);
        setTree([]);
        setParts(null);
        setError(
          `VIN состоит из 17 символов (у вас ${vin.length}). Введите номер полностью, без пробелов.`
        );
        return;
      }
      try {
        sessionStorage.removeItem(NAV_STORAGE_KEY);
      } catch {}
      setLoading("cars");
      setError("");
      setCar(null);
      setCars([]);
      setParts(null);
      setSelectedId(null);
      setTree([]);
      setWiz(null);
      try {
        const data = await fetchJson<{ cars: GoodvinCarInfo[] }>(
          `/api/goodvin/car-info?q=${encodeURIComponent(vin)}`
        );
        if (!data.cars.length) {
          setError(
            "По этому VIN автомобиль не найден. Проверьте номер — возможно, опечатка."
          );
          return;
        }
        if (data.cars.length === 1) selectCar(data.cars[0]);
        else setCars(data.cars);
      } catch (e) {
        setError(friendlyVinError((e as Error).message));
      } finally {
        setLoading(null);
      }
    },
    [selectCar, runPlateSearch, runFrameSearch]
  );

  // Восстановление позиции (возврат «Назад» из карточки цен) либо заход по initialVin.
  useEffect(() => {
    let restored = false;
    try {
      const raw = sessionStorage.getItem(NAV_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as SavedNav;
        // Восстанавливаем позицию ТОЛЬКО когда: 1) вернулись «Назад» из цен
        // (в URL тот же номер, что в сохранённой позиции) или 2) машину
        // передал виджет подбора с главной (handoff). Обычный заход без
        // параметров — с чистого листа, чтобы легче было искать другую машину.
        const matchesInitial =
          !!initialVin &&
          (saved.car?.vin || saved.car?.frame || saved.query || "")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "") ===
            initialVin.toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (saved?.car && (matchesInitial || saved.handoff)) {
          restored = true;
          setQuery(saved.query || "");
          setCar(saved.car);
          modeRef.current = saved.mode === "cat" ? "cat" : "quick";
          void loadTree(saved.car);
          if (saved.leaf) void loadParts(saved.car, saved.leaf);
        } else if (!initialVin && !initialPlate && !initialFrame) {
          sessionStorage.removeItem(NAV_STORAGE_KEY);
        }
      }
    } catch {}
    if (!restored && initialVin) {
      setQuery(initialVin);
      void runSearch(initialVin);
    } else if (!restored && initialPlate) {
      setQuery(initialPlate);
      void runPlateSearch(initialPlate);
    } else if (!restored && initialFrame) {
      setQuery(initialFrame);
      void runFrameSearch(initialFrame);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Новый номер из ШАПКИ сайта, когда каталог уже открыт с машиной: URL
  // меняется, но компонент не перемонтируется — mount-эффект выше не
  // срабатывает. Реагируем на смену initial-пропсов и ищем новое авто.
  const initialRef = useRef({
    vin: initialVin,
    plate: initialPlate,
    frame: initialFrame,
  });
  useEffect(() => {
    const prev = initialRef.current;
    if (
      prev.vin === initialVin &&
      prev.plate === initialPlate &&
      prev.frame === initialFrame
    )
      return;
    initialRef.current = {
      vin: initialVin,
      plate: initialPlate,
      frame: initialFrame,
    };
    if (initialVin) {
      setQuery(initialVin);
      void runSearch(initialVin);
    } else if (initialPlate) {
      setQuery(initialPlate);
      void runPlateSearch(initialPlate);
    } else if (initialFrame) {
      setQuery(initialFrame);
      void runFrameSearch(initialFrame);
    }
  }, [
    initialVin,
    initialPlate,
    initialFrame,
    runSearch,
    runPlateSearch,
    runFrameSearch,
  ]);

  // Запоминаем позицию, пока выбрано авто.
  useEffect(() => {
    if (!car) return;
    try {
      const snapshot: SavedNav = {
        query,
        car,
        mode: modeRef.current,
        leaf: selectedId
          ? { id: selectedId, name: selectedName, ssd: selectedSsd }
          : null,
      };
      sessionStorage.setItem(NAV_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {}
  }, [car, selectedId, selectedName, selectedSsd, query]);

  function resetSearch() {
    try {
      sessionStorage.removeItem(NAV_STORAGE_KEY);
    } catch {}
    setCar(null);
    setCars([]);
    setTree([]);
    setParts(null);
    setSelectedId(null);
    setError("");
    setWiz(null);
  }

  const visibleTop = tree.filter((n) => nodeMatches(n, filter));

  // Список марок нужен только в «пустом» состоянии (нет авто и не идёт поиск).
  const showBrowse = !car && cars.length === 0 && loading === null;

  useEffect(() => {
    if (!showBrowse || brands !== null) return;
    let alive = true;
    fetchJson<{ brands: BrandItem[] }>("/api/goodvin/brands")
      .then((d) => {
        if (alive) setBrands(d.brands.filter((b) => b.wizard));
      })
      .catch(() => {
        if (alive) setBrands([]); // без списка марок каталог по VIN всё равно работает
      });
    return () => {
      alive = false;
    };
  }, [showBrowse, brands]);

  // Марки, сгруппированные по первой букве (как в демо Laximo: колонки A–Z).
  const groupedBrands = useMemo(() => {
    if (!brands) return [];
    const m = new Map<string, BrandItem[]>();
    for (const b of brands) {
      const letter = (b.name[0] || "#").toUpperCase();
      if (!m.has(letter)) m.set(letter, []);
      m.get(letter)!.push(b);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [brands]);

  // На мобилке показываем ЛИБО дерево, ЛИБО выбранный узел/результаты поиска
  // (мастер-деталь) — иначе длинное дерево «отжимает» схему вниз. На десктопе
  // (lg+) видно и то, и другое. Кнопка «← К узлам» возвращает к дереву.
  const mobileShowContent =
    viewTab === "schemes"
      ? unitsLoading || unitsList !== null || schemeUnit !== null
      : loading === "parts" ||
        searching ||
        searchResults !== null ||
        parts !== null;

  function backToTree() {
    if (viewTab === "schemes") {
      // Шаг назад: из узла — к плитке узлов, из плитки — к категориям.
      if (schemeUnit) {
        setSchemeUnit(null);
        setSchemeGroup(null);
      } else {
        setUnitsList(null);
        setSelCatId(null);
      }
      return;
    }
    setParts(null);
    setSelectedId(null);
    setSearchResults(null);
    setOemView(null);
  }

  return (
    <div className="space-y-6">
      {/* Поиск авто по VIN. Когда машина уже выбрана — прячем: ту же функцию
          выполняет поиск в шапке сайта, а тут место нужнее деталям. */}
      {!car && (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch(query);
        }}
        className="flex flex-col sm:flex-row gap-3"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value.toUpperCase())}
            placeholder="VIN, гос номер или номер кузова — WAUZZZ4M6JD010702 / Т500СО66 / AGH30-0115914"
            className="pl-10 font-mono tracking-wide uppercase"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="gap-2 shrink-0"
          disabled={loading === "cars" || !query.trim()}
        >
          {loading === "cars" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Search className="h-5 w-5" />
          )}
          Найти авто
        </Button>
      </form>
      )}

      {error && <ErrorBox message={error} />}
      {loading === "cars" && <Spinner label="Ищем автомобиль по номеру…" />}

      {/* Выбор авто (несколько совпадений) */}
      {cars.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-neutral-400">
            Найдено несколько вариантов — выберите свой:
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {cars.map((c) => {
              const params = [...(c.parameters ?? [])].sort(
                (a, b) => a.sortOrder - b.sortOrder
              );
              return (
                <button
                  key={c.carId}
                  onClick={() => selectCar(c)}
                  className="group flex items-start gap-4 rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-left transition-colors hover:border-orange-500/50 hover:bg-neutral-800/50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-500">
                    <Car className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white">
                      {c.brand} {c.modelName}
                    </p>
                    <p className="text-sm text-neutral-400">
                      {c.description || c.title}
                    </p>
                    {params.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {params.map((p) => (
                          <span
                            key={p.idx}
                            className="rounded-md bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300"
                          >
                            <span className="text-neutral-500">{p.name}:</span>{" "}
                            {p.value}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="ml-auto h-5 w-5 shrink-0 self-center text-neutral-600 transition-colors group-hover:text-orange-500" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Вход без VIN: выбор марки → мастер «модель / год / двигатель…» */}
      {showBrowse && wiz && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setWiz(null)}
            className="inline-flex items-center gap-1.5 text-sm text-neutral-400 transition-colors hover:text-orange-400"
          >
            <ArrowLeft className="h-4 w-4" />
            Все марки
          </button>

          <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-4 md:p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-500">
                <Car className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-white">{wiz.catalog.name}</p>
                <p className="text-xs text-neutral-400">
                  Подбор автомобиля по параметрам
                </p>
              </div>
            </div>

            {wizLoading && wiz.steps.length === 0 ? (
              <Spinner label="Загружаем параметры…" />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {wiz.steps
                  .filter((s) => s.options.length > 0 || s.determined)
                  .map((s) => (
                    <label key={s.conditionId || s.name} className="block">
                      <span className="mb-1 block text-xs text-neutral-500">
                        {s.name}
                      </span>
                      {s.options.length > 0 ? (
                        <select
                          value=""
                          disabled={wizLoading}
                          onChange={(e) => {
                            if (e.target.value)
                              void loadWizard(wiz.catalog, e.target.value);
                          }}
                          className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-orange-500/50 focus:outline-none disabled:opacity-50"
                        >
                          <option value="">
                            {s.determined && s.value ? s.value : "Не выбрано"}
                          </option>
                          {s.options.map((o) => (
                            <option key={o.key} value={o.key}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-sm font-medium text-orange-300">
                          {s.value ?? "—"}
                        </div>
                      )}
                    </label>
                  ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => void wizardShowCars()}
                disabled={!wiz.ssd || wizLoading}
                className="gap-2"
              >
                <Car className="h-4 w-4" />
                Показать автомобили
              </Button>
              {wiz.ssd && (
                <Button
                  variant="outline"
                  disabled={wizLoading}
                  onClick={() => void loadWizard(wiz.catalog, "")}
                >
                  Сбросить
                </Button>
              )}
              {wizLoading && wiz.steps.length > 0 && (
                <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
              )}
            </div>
            <p className="text-xs text-neutral-500">
              Чем больше параметров выберете, тем точнее список автомобилей.
            </p>
          </div>
        </div>
      )}

      {showBrowse && !wiz && (
        <div className="space-y-3">
          <p className="text-sm text-neutral-400">
            Не знаете VIN? Выберите марку автомобиля:
          </p>
          {brands === null ? (
            <Spinner label="Загружаем марки…" />
          ) : brands.length > 0 ? (
            <div className="columns-2 gap-6 sm:columns-3 lg:columns-4">
              {groupedBrands.map(([letter, list]) => (
                <div key={letter} className="mb-4 break-inside-avoid">
                  <p className="mb-1 px-2 text-xs font-bold text-neutral-600">
                    {letter}
                  </p>
                  {list.map((b) => (
                    <button
                      key={b.code}
                      type="button"
                      onClick={() => openBrand(b)}
                      className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-neutral-300 transition-colors hover:bg-neutral-800/60 hover:text-orange-400"
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* Окно с параметрами машины (как «Список параметров» у Армтек) */}
      {car && carInfoOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setCarInfoOpen(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <p className="text-lg font-bold text-white">
                {car.brand} {car.modelName}
              </p>
              <button
                type="button"
                onClick={() => setCarInfoOpen(false)}
                className="rounded-lg bg-neutral-800 p-2 text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-white"
                title="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1.5 text-sm">
              {(car.vin || car.frame) && (
                <p>
                  <span className="text-neutral-500">
                    {car.vin ? "VIN: " : "Кузов: "}
                  </span>
                  <span className="font-mono text-neutral-200">
                    {car.vin || car.frame}
                  </span>
                </p>
              )}
              {[...(car.parameters ?? [])]
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((p) => (
                  <p key={p.idx}>
                    <span className="text-neutral-500">{p.name}: </span>
                    <span className="text-neutral-200">{p.value}</span>
                  </p>
                ))}
              {!car.parameters?.length && car.description && (
                <p className="text-neutral-300">{car.description}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Выбранное авто + дерево слева, детали справа */}
      {car && (
        <div className="space-y-4">
          {/* Хлебные крошки — как в демо Laximo: клик по уровню возвращает назад
              (к списку узлов / к новому поиску). Интуитивная навигация. */}
          <nav
            aria-label="Навигация по каталогу"
            className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm"
          >
            <button
              type="button"
              onClick={resetSearch}
              className="text-neutral-400 transition-colors hover:text-orange-400"
            >
              Поиск по VIN
            </button>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-600" />
            {parts || searchResults !== null ? (
              <button
                type="button"
                onClick={backToTree}
                className="max-w-[45vw] truncate text-neutral-400 transition-colors hover:text-orange-400"
              >
                {car.brand} {car.modelName}
              </button>
            ) : (
              <span className="max-w-[60vw] truncate font-medium text-white">
                {car.brand} {car.modelName}
              </span>
            )}
            {(parts || searchResults !== null) && (
              <>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-600" />
                <span className="max-w-[60vw] truncate font-medium text-white">
                  {searchResults !== null
                    ? `Поиск: ${partQuery}`
                    : selectedName}
                </span>
              </>
            )}
          </nav>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-500">
                <Car className="h-5 w-5" />
              </div>
              <p className="font-semibold text-white truncate">
                {car.brand} {car.modelName}
              </p>
              {/* Параметры машины — в отдельном окне, чтобы не съедали место */}
              <button
                type="button"
                onClick={() => setCarInfoOpen(true)}
                title="Параметры автомобиля"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-700 text-neutral-400 transition-colors hover:border-orange-500 hover:text-orange-400"
              >
                <Info className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Как у Армтек: «Поиск по группам» / «Перейти на список узлов» */}
              <div className="flex overflow-hidden rounded-lg border border-neutral-700">
                <button
                  type="button"
                  onClick={() => setViewTab("groups")}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    viewTab === "groups"
                      ? "bg-orange-500 text-white"
                      : "bg-neutral-800 text-neutral-300 hover:text-white"
                  }`}
                >
                  Группы
                </button>
                <button
                  type="button"
                  onClick={() => void openSchemesTab()}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    viewTab === "schemes"
                      ? "bg-orange-500 text-white"
                      : "bg-neutral-800 text-neutral-300 hover:text-white"
                  }`}
                >
                  Все схемы
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={resetSearch}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Другой VIN
              </Button>
            </div>
          </div>

          {/* Поиск детали по названию или OEM-номеру внутри этого авто
              (убирали 13.08 — владелец попросил вернуть на следующий день) */}
          {!!tree.length && (
            <form onSubmit={doPartSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <Input
                  value={partQuery}
                  onChange={(e) => setPartQuery(e.target.value)}
                  placeholder="Поиск детали по названию или OEM-номеру…"
                  className="pl-10"
                  autoComplete="off"
                />
              </div>
              <Button
                type="submit"
                className="gap-2 shrink-0"
                disabled={searching || !partQuery.trim()}
              >
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Найти
              </Button>
              {searchResults !== null && (
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => {
                    setSearchResults(null);
                    setPartQuery("");
                  }}
                >
                  Сбросить
                </Button>
              )}
            </form>
          )}

          {loading === "tree" && <Spinner label="Загружаем каталог…" />}

          {!!tree.length && (
            <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
              {/* Дерево узлов слева (на мобилке прячется, когда открыт узел) */}
              <aside
                className={`rounded-xl border border-neutral-800 bg-neutral-900 lg:sticky lg:top-4 self-start ${
                  mobileShowContent ? "hidden lg:block" : ""
                }`}
              >
                {viewTab === "schemes" ? (
                  // «Все схемы»: слева категории каталога
                  <div className="max-h-[70vh] overflow-y-auto p-1.5">
                    {catsLoading ? (
                      <Spinner label="Загружаем категории…" />
                    ) : cats && cats.length ? (
                      cats.map((n) => (
                        <TreeNode
                          key={n.id}
                          node={n}
                          depth={0}
                          filter=""
                          expanded={catExpanded}
                          toggle={toggleCat}
                          selectedId={selCatId}
                          onSelect={(node) => void selectSchemeCat(node)}
                        />
                      ))
                    ) : (
                      <p className="p-3 text-sm text-neutral-500">
                        Категории недоступны для этого каталога
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="border-b border-neutral-800 p-2.5">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
                        <input
                          value={filter}
                          onChange={(e) =>
                            setFilter(e.target.value.toLowerCase())
                          }
                          placeholder="Название узла…"
                          className="w-full rounded-lg bg-neutral-950 border border-neutral-800 py-1.5 pl-8 pr-2 text-sm text-white placeholder:text-neutral-600 focus:border-orange-500/50 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="max-h-[70vh] overflow-y-auto p-1.5">
                      {visibleTop.length ? (
                        visibleTop.map((n) => (
                          <TreeNode
                            key={n.id}
                            node={n}
                            depth={0}
                            filter={filter}
                            expanded={expanded}
                            toggle={toggle}
                            selectedId={selectedId}
                            onSelect={onSelectLeaf}
                          />
                        ))
                      ) : (
                        <p className="p-3 text-sm text-neutral-500">
                          Ничего не найдено
                        </p>
                      )}
                    </div>
                  </>
                )}
              </aside>

              {/* Панель деталей справа (на мобилке — вместо дерева) */}
              <div
                className={`min-w-0 ${mobileShowContent ? "" : "hidden lg:block"}`}
              >
                {/* Мобильная кнопка возврата к дереву узлов */}
                <button
                  type="button"
                  onClick={backToTree}
                  className="mb-3 inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-orange-400 transition-colors lg:hidden"
                >
                  <ArrowLeft className="h-4 w-4" />
                  К списку узлов
                </button>
                {viewTab === "schemes" ? (
                  // «Все схемы»: плитка узлов категории → открытый узел
                  schemeLoading ? (
                    <Spinner label="Загружаем узел…" />
                  ) : schemeUnit && schemeGroup ? (
                    <div className="space-y-3">
                      {/* Кнопка как у Армтек: «Перейти на список узлов» */}
                      <button
                        type="button"
                        onClick={() => {
                          setSchemeUnit(null);
                          setSchemeGroup(null);
                        }}
                        className="hidden lg:inline-flex items-center gap-1.5 text-sm text-neutral-400 transition-colors hover:text-orange-400"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        К списку узлов
                      </button>
                      <div className="flex items-center gap-2 text-sm text-neutral-300">
                        <FolderTree className="h-4 w-4 text-orange-500" />
                        <span className="font-semibold text-white">
                          {schemeGroup.number} · {schemeGroup.name}
                        </span>
                      </div>
                      <UnitBlock
                        group={schemeGroup}
                        backVin={car.vin || car.frame || query}
                        fromBrand={car.brand}
                        single
                        catalogId={car.catalogId}
                        carId={car.carId}
                      />
                    </div>
                  ) : unitsLoading ? (
                    <Spinner label="Загружаем узлы…" />
                  ) : unitsList ? (
                    <div className="space-y-3">
                      <p className="text-sm text-neutral-400">
                        <span className="font-semibold text-white">
                          {selCatName}
                        </span>{" "}
                        — узлов: {unitsList.length}. Нажмите на схему.
                      </p>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                        {unitsList.map((u) => (
                          <button
                            key={`${u.unitId}-${u.code}`}
                            type="button"
                            onClick={() => void openSchemeUnit(u)}
                            className="group rounded-xl border border-neutral-800 bg-neutral-900 p-2 text-left transition-colors hover:border-orange-500/50"
                          >
                            <div className="mb-2 flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-white">
                              {u.img ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={u.img}
                                  alt={u.name}
                                  loading="lazy"
                                  className="h-full w-full object-contain p-1"
                                />
                              ) : (
                                <Package className="h-8 w-8 text-neutral-300" />
                              )}
                            </div>
                            <p className="font-mono text-xs font-bold text-orange-400">
                              {u.code}
                            </p>
                            <p className="line-clamp-2 text-xs text-neutral-300 transition-colors group-hover:text-white">
                              {u.name}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-neutral-800 py-20 text-center text-neutral-500">
                      <MousePointerClick className="h-8 w-8 text-neutral-700" />
                      <p className="text-sm">
                        Выберите категорию слева —
                        <br />
                        покажем все схемы узлов с превью
                      </p>
                    </div>
                  )
                ) : loading === "parts" || searching ? (
                  <Spinner
                    label={searching ? "Ищем деталь…" : "Загружаем детали узла…"}
                  />
                ) : searchResults !== null ? (
                  <div className="space-y-4">
                    <SearchResultsView
                      results={searchResults}
                      query={partQuery}
                      backVin={car.vin || car.frame || query}
                      fromBrand={car.brand}
                      activeOem={oemView?.oem ?? oemLoading}
                      loadingOem={oemLoading}
                      onSelect={(oem) => void openOemResult(oem)}
                    />
                    {oemLoading ? (
                      <Spinner label="Ищем деталь на схемах…" />
                    ) : oemView?.parts ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-neutral-300">
                          <FolderTree className="h-4 w-4 text-orange-500" />
                          <span className="font-semibold text-white">
                            {oemView.parts.partGroups[0]?.name || oemView.oem}
                          </span>
                          <span className="font-mono text-xs text-neutral-500">
                            {oemView.oem}
                          </span>
                        </div>
                        <PartsView
                          parts={oemView.parts}
                          backVin={car.vin || car.frame || query}
                          fromBrand={car.brand}
                          catalogId={car.catalogId}
                          carId={car.carId}
                          highlightOem={oemView.oem}
                        />
                      </div>
                    ) : oemView ? (
                      <p className="rounded-xl border border-dashed border-neutral-800 py-6 text-center text-sm text-neutral-500">
                        Для этого номера каталог не отдаёт схему узла — но цены
                        доступны по кнопке выше.
                      </p>
                    ) : null}
                  </div>
                ) : parts ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-neutral-300">
                      <FolderTree className="h-4 w-4 text-orange-500" />
                      <span className="font-semibold text-white">
                        {selectedName}
                      </span>
                    </div>
                    <PartsView
                      parts={parts}
                      backVin={car.vin || car.frame || query}
                      fromBrand={car.brand}
                      catalogId={car.catalogId}
                      carId={car.carId}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-neutral-800 py-20 text-center text-neutral-500">
                    <MousePointerClick className="h-8 w-8 text-neutral-700" />
                    <p className="text-sm">
                      Выберите узел в дереве слева —
                      <br />
                      покажем схему и детали с оригинальными номерами
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Результаты поиска детали по названию/номеру. Клик по строке загружает
 *  схемы узлов, где стоит эта деталь (как у Армтек: «фото + артикул»). */
function SearchResultsView({
  results,
  query,
  backVin,
  fromBrand,
  activeOem,
  loadingOem,
  onSelect,
}: {
  results: Array<{ number: string; name: string }>;
  query: string;
  backVin?: string;
  fromBrand?: string;
  activeOem?: string | null;
  loadingOem?: string | null;
  onSelect?: (oem: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-400">
        {results.length
          ? `Найдено по запросу «${query}»: ${results.length}${
              results.length > 1 ? " — выберите вариант, покажем его на схеме" : ""
            }`
          : `По запросу «${query}» ничего не найдено`}
      </p>
      {results.length > 0 && (
        <div className="divide-y divide-neutral-800 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
          {results.map((r, i) => {
            const isActive = activeOem === r.number;
            return (
              <div
                key={`${r.number}-${i}`}
                onClick={() => onSelect?.(r.number)}
                className={`flex items-center gap-3 p-3 transition-colors ${
                  onSelect ? "cursor-pointer" : ""
                } ${
                  isActive
                    ? "bg-orange-500/10 ring-1 ring-inset ring-orange-500/50"
                    : "hover:bg-neutral-800/40"
                }`}
              >
                {loadingOem === r.number ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-orange-500" />
                ) : (
                  <Package
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? "text-orange-500" : "text-neutral-600"
                    }`}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-100">
                    {r.name}
                  </p>
                  <p className="font-mono text-xs text-neutral-400">
                    {r.number}
                  </p>
                </div>
                <Link
                  href={`/catalog?article=${encodeURIComponent(r.number)}${
                    backVin ? `&fromVin=${encodeURIComponent(backVin)}` : ""
                  }${
                    fromBrand ? `&fromBrand=${encodeURIComponent(fromBrand)}` : ""
                  }`}
                  className="shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Tag className="h-3.5 w-3.5" />
                    Цены
                  </Button>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Детали узла: каждый УЗЕЛ (unit) рисуется полностью — своя схема + свои
 *  выноски + свои детали. У сложных групп узлов их несколько. */
function PartsView({
  parts,
  backVin,
  fromBrand,
  catalogId,
  carId,
  highlightOem,
}: {
  parts: GoodvinParts;
  backVin?: string;
  fromBrand?: string;
  catalogId?: string;
  carId?: string;
  /** OEM из поиска — подсветить эту деталь на схеме и в списке. */
  highlightOem?: string;
}) {
  const units = parts.partGroups;
  if (!units.length) {
    return (
      <p className="py-10 text-center text-sm text-neutral-500">
        В этом узле нет деталей.
      </p>
    );
  }
  const single = units.length === 1;
  return (
    <div className="space-y-4">
      {units.map((g, i) => (
        <UnitBlock
          // Ключ ОБЯЗАН меняться при смене узла: у узлов бывает пустой code, и
          // одинаковый ключ заставлял React переиспользовать блок — состояние
          // «все детали узла» предыдущего узла утекало в новый (схема ремня,
          // а справа детали масляного фильтра).
          key={`${g.unitId || g.number || g.name}-${i}`}
          group={g}
          backVin={backVin}
          fromBrand={fromBrand}
          single={single}
          catalogId={catalogId}
          carId={carId}
          highlightOem={highlightOem}
        />
      ))}
    </div>
  );
}

/** Один узел: схема слева с кликабельными выносками, детали справа. */
/** Нормализация артикула для сравнения: «5960 L0» и «5960L0» — одна деталь. */
const normOem = (s: string) => s.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

function UnitBlock({
  group,
  backVin,
  fromBrand,
  single,
  catalogId,
  carId,
  highlightOem,
}: {
  group: GoodvinParts["partGroups"][number];
  backVin?: string;
  fromBrand?: string;
  single: boolean;
  catalogId?: string;
  carId?: string;
  highlightOem?: string;
}) {
  const hlOem = highlightOem ? normOem(highlightOem) : null;
  // Искомая деталь (из поиска по OEM) сразу активна — её позиция подсвечена
  // на схеме, без лишнего клика.
  const [active, setActive] = useState<string | null>(() => {
    if (!hlOem) return null;
    return (
      group.parts.find((p) => p.number && normOem(p.number) === hlOem)
        ?.positionNumber ?? null
    );
  });
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  // Полноэкранный просмотр схемы (клик по картинке / кнопка-лупа).
  const [lightbox, setLightbox] = useState(false);
  // Открытая подсказка-ⓘ (индекс детали) — примечание/количество/период.
  const [infoOpen, setInfoOpen] = useState<number | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Быстрая группа содержит лишь часть деталей узла (напр., один фильтр из 14
  // позиций схемы) — по кнопке догружаем ПОЛНЫЙ список деталей узла.
  const [fullParts, setFullParts] = useState<GoodvinPart[] | null>(null);
  const [showFull, setShowFull] = useState(false);
  const [loadingFull, setLoadingFull] = useState(false);
  const canLoadFull = Boolean(catalogId && carId && group.unitId && group.unitSsd);

  const toggleFull = useCallback(async () => {
    if (fullParts) {
      setShowFull((v) => !v);
      return;
    }
    if (!catalogId || !carId || !group.unitId || !group.unitSsd) return;
    setLoadingFull(true);
    try {
      const data = await fetchJson<{ parts: GoodvinPart[] }>(
        `/api/goodvin/unit-parts?catalogId=${encodeURIComponent(
          catalogId
        )}&carId=${encodeURIComponent(carId)}&unitId=${encodeURIComponent(
          group.unitId
        )}&ssd=${encodeURIComponent(group.unitSsd)}`
      );
      setFullParts(data.parts);
      setShowFull(true);
    } catch {
      // Не получилось — остаёмся на деталях группы, без пугающих ошибок.
    } finally {
      setLoadingFull(false);
    }
  }, [fullParts, catalogId, carId, group.unitId, group.unitSsd]);

  const shownParts = showFull && fullParts ? fullParts : group.parts;

  const positions = group.positions ?? [];
  const hasHotspots = Boolean(img(group.img)) && positions.length > 0;

  // Смена узла: сбрасываем «полный список» предыдущего узла (страховка вдобавок
  // к key — иначе чужие детали остались бы под новой схемой). И если на схеме
  // выносок больше, чем деталей в быстрой группе (схема узла с 14 позициями, а
  // в группе «Фильтр масляный» — один фильтр) — полный список узла догружаем
  // СРАЗУ, не дожидаясь клика (ответ в кэше 24ч — тариф не страдает).
  useEffect(() => {
    setFullParts(null);
    setShowFull(false);
    if (!(catalogId && carId && group.unitId && group.unitSsd)) return;
    if ((group.positions?.length ?? 0) <= group.parts.length) return;
    let alive = true;
    setLoadingFull(true);
    fetchJson<{ parts: GoodvinPart[] }>(
      `/api/goodvin/unit-parts?catalogId=${encodeURIComponent(
        catalogId
      )}&carId=${encodeURIComponent(carId)}&unitId=${encodeURIComponent(
        group.unitId
      )}&ssd=${encodeURIComponent(group.unitSsd)}`
    )
      .then((d) => {
        if (alive) {
          setFullParts(d.parts);
          setShowFull(true);
        }
      })
      .catch(() => {}) // не вышло — остаёмся на деталях группы
      .finally(() => {
        if (alive) setLoadingFull(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.unitId, group.unitSsd, group.number, group.name]);

  const selectFromImage = useCallback((num: string) => {
    setActive((prev) => (prev === num ? null : num));
    const el = rowRefs.current[num];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);
  const selectFromList = useCallback((num: string) => {
    setActive((prev) => (prev === num ? null : num));
  }, []);

  // Варианты (несколько деталей на одной выноске) — в рамках этого узла.
  const posCounts = new Map<string, number>();
  for (const p of shownParts) {
    const k = p.positionNumber || "";
    if (k) posCounts.set(k, (posCounts.get(k) ?? 0) + 1);
  }
  const variantSeen = new Map<string, number>();
  const variantInfo = new Map<number, { index: number; total: number }>();
  shownParts.forEach((p, pi) => {
    const k = p.positionNumber || "";
    const total = k ? posCounts.get(k) ?? 0 : 0;
    if (total > 1) {
      const index = (variantSeen.get(k) ?? 0) + 1;
      variantSeen.set(k, index);
      variantInfo.set(pi, { index, total });
    }
  });

  return (
    <div
      className={
        single ? "" : "rounded-xl border border-neutral-800 bg-neutral-900/30 p-3 md:p-4"
      }
    >
      {/* Название узла — только когда узлов несколько (иначе оно уже в шапке). */}
      {!single && group.name && (
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <FolderTree className="h-4 w-4 shrink-0 text-orange-500" />
          {group.name}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Схема с выносками */}
        {img(group.img) && (
          <div className="lg:sticky lg:top-4 self-start space-y-2">
            <div className="relative overflow-hidden rounded-xl border border-neutral-800 bg-white">
              {/* Кнопка-лупа: раскрыть схему на весь экран */}
              <button
                type="button"
                onClick={() => setLightbox(true)}
                title="Увеличить схему"
                className="absolute right-2 top-2 z-10 rounded-lg bg-neutral-900/75 p-2.5 text-white shadow-md transition-colors hover:bg-orange-500"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img(group.img)}
                alt={group.imgDescription || "Схема узла"}
                className="block h-auto w-full cursor-zoom-in select-none"
                onClick={() => setLightbox(true)}
                onLoad={(e) =>
                  setDims({
                    w: e.currentTarget.naturalWidth,
                    h: e.currentTarget.naturalHeight,
                  })
                }
              />
              {dims &&
                positions.map((pos) => {
                  const c = pos.coordinates;
                  if (!c || c.length < 4) return null;
                  const PAD = 7;
                  const x = Math.max(0, c[0] - PAD);
                  const y = Math.max(0, c[1] - PAD);
                  const left = (x / dims.w) * 100;
                  const top = (y / dims.h) * 100;
                  const width = ((c[2] + PAD * 2) / dims.w) * 100;
                  const height = ((c[3] + PAD * 2) / dims.h) * 100;
                  const isActive = active === pos.number;
                  return (
                    <button
                      key={`${pos.number}-${left}-${top}`}
                      type="button"
                      onClick={() => selectFromImage(pos.number)}
                      title={`Позиция ${pos.number} — нажмите, чтобы найти деталь в списке`}
                      style={{
                        left: `${left}%`,
                        top: `${top}%`,
                        width: `${width}%`,
                        height: `${height}%`,
                      }}
                      className={`absolute cursor-pointer rounded-md border transition-all ${
                        isActive
                          ? "border-orange-500 bg-orange-500/40 ring-2 ring-orange-500/30"
                          : "border-orange-400/70 bg-orange-400/15 hover:border-orange-500 hover:bg-orange-500/30 hover:ring-2 hover:ring-orange-500/25"
                      }`}
                    />
                  );
                })}
            </div>
            {hasHotspots && (
              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-neutral-400">
                <span className="inline-block h-3 w-4 rounded-[3px] border border-orange-400/70 bg-orange-400/15" />
                Номера на схеме кликабельны — нажмите, чтобы найти деталь
              </p>
            )}
            {lightbox && (
              <UnitLightbox
                src={img(group.img)!}
                alt={group.imgDescription || group.name || "Схема узла"}
                positions={positions}
                parts={shownParts}
                backVin={backVin}
                fromBrand={fromBrand}
                onClose={() => setLightbox(false)}
              />
            )}
          </div>
        )}

        {/* Список деталей этого узла */}
        <div className="divide-y divide-neutral-800 self-start overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
          {shownParts.map((part, pi) => {
            const pos = part.positionNumber || "";
            const isActive = pos !== "" && active === pos;
            const variant = variantInfo.get(pi);
            const isSearched = Boolean(
              hlOem && part.number && normOem(part.number) === hlOem
            );
            return (
              <div
                key={`${part.id}-${pi}`}
                ref={(el) => {
                  if (pos) rowRefs.current[pos] = el;
                }}
                onClick={() => pos && selectFromList(pos)}
                className={`p-3 transition-colors ${
                  pos ? "cursor-pointer" : ""
                } ${
                  isActive
                    ? "bg-orange-500/10 ring-1 ring-inset ring-orange-500/50"
                    : isSearched
                      ? "bg-orange-500/5 hover:bg-neutral-800/40"
                      : "hover:bg-neutral-800/40"
                }`}
              >
              <div className="flex items-center gap-3">
                {part.positionNumber && (
                  <span
                    className={`flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md px-1.5 text-xs font-bold ${
                      isActive
                        ? "bg-orange-500 text-white"
                        : "bg-orange-500/15 text-orange-400"
                    }`}
                  >
                    {part.positionNumber}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-100">
                    {part.name}
                    {isSearched && (
                      <span className="ml-2 inline-block whitespace-nowrap rounded bg-orange-500 px-1.5 py-0.5 align-middle text-[11px] font-semibold text-white">
                        искомая деталь
                      </span>
                    )}
                    {variant && (
                      <span
                        title="На этой позиции схемы несколько артикулов — выберите подходящий"
                        className="ml-2 inline-block whitespace-nowrap rounded bg-orange-500/10 px-1.5 py-0.5 align-middle text-[11px] font-medium text-orange-400/90"
                      >
                        вариант {variant.index} из {variant.total}
                      </span>
                    )}
                  </p>
                  {part.number && (
                    <p className="font-mono text-xs text-neutral-400">
                      {part.number}
                    </p>
                  )}
                  {part.notice && (
                    <p className="text-xs text-neutral-500">{part.notice}</p>
                  )}
                </div>
                {/* Подсказка-ⓘ: примечание, количество, период, применимость */}
                {!!part.attributes?.length && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setInfoOpen((v) => (v === pi ? null : pi));
                    }}
                    title="Информация о детали"
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
                      infoOpen === pi
                        ? "border-orange-500 bg-orange-500 text-white"
                        : "border-neutral-700 text-neutral-400 hover:border-orange-500 hover:text-orange-400"
                    }`}
                  >
                    <Info className="h-4 w-4" />
                  </button>
                )}
                {part.number && (
                  <Link
                    href={`/catalog?article=${encodeURIComponent(part.number)}${
                      backVin ? `&fromVin=${encodeURIComponent(backVin)}` : ""
                    }${
                      fromBrand
                        ? `&fromBrand=${encodeURIComponent(fromBrand)}`
                        : ""
                    }`}
                    className="shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <Tag className="h-3.5 w-3.5" />
                      Цены
                    </Button>
                  </Link>
                )}
              </div>
              {/* Раскрытая подсказка */}
              {infoOpen === pi && !!part.attributes?.length && (
                <div
                  className="mt-2 space-y-1 rounded-lg border border-neutral-800 bg-neutral-950/60 p-3 text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  {part.number && (
                    <p>
                      <span className="text-neutral-500">OEM: </span>
                      <span className="font-mono text-neutral-200">
                        {part.number}
                      </span>
                    </p>
                  )}
                  {part.attributes.map((a) => (
                    <p key={a.key}>
                      <span className="text-neutral-500">{attrLabel(a)}: </span>
                      <span className="text-neutral-200">{a.value}</span>
                    </p>
                  ))}
                </div>
              )}
              </div>
            );
          })}

          {/* Быстрая группа показывает лишь часть узла — кнопка раскрывает
              полный список деталей со схемы (как в общем каталоге). */}
          {canLoadFull && (
            <button
              type="button"
              onClick={() => void toggleFull()}
              disabled={loadingFull}
              className="flex w-full items-center justify-center gap-2 bg-neutral-800/30 py-2.5 text-xs font-medium text-neutral-400 transition-colors hover:bg-neutral-800/60 hover:text-orange-400 disabled:opacity-60"
            >
              {loadingFull ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    showFull ? "rotate-180" : ""
                  }`}
                />
              )}
              {showFull
                ? "Только детали группы"
                : `Все детали узла со схемы${
                    fullParts ? ` (${fullParts.length})` : ""
                  }`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default VinCatalog;
