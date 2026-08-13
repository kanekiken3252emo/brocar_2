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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  GoodvinCarInfo,
  GoodvinGroupNode,
  GoodvinPart,
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

interface SavedNav {
  query: string;
  car: GoodvinCarInfo;
  mode: CatalogMode;
  leaf: { id: string; name: string; ssd?: string } | null;
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

export function VinCatalog({
  initialVin,
  initialPlate,
}: {
  initialVin?: string;
  initialPlate?: string;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState<null | "cars" | "tree" | "parts">(
    null
  );
  const [error, setError] = useState("");

  const [cars, setCars] = useState<GoodvinCarInfo[]>([]);
  const [car, setCar] = useState<GoodvinCarInfo | null>(null);

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

  // Поиск детали по названию/номеру внутри каталога авто.
  const [partQuery, setPartQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{
    number: string;
    name: string;
  }> | null>(null);
  const [searching, setSearching] = useState(false);

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

  const doPartSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!car) return;
      const q = partQuery.trim();
      if (!q) {
        setSearchResults(null);
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
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setSearching(false);
      }
    },
    [car, partQuery]
  );

  const selectCar = useCallback(
    (selectedCar: GoodvinCarInfo) => {
      setCar(selectedCar);
      setCars([]);
      setParts(null);
      setSelectedId(null);
      setSelectedName("");
      setFilter("");
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
    [selectCar, runPlateSearch]
  );

  // Восстановление позиции (возврат «Назад» из карточки цен) либо заход по initialVin.
  useEffect(() => {
    let restored = false;
    try {
      const raw = sessionStorage.getItem(NAV_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as SavedNav;
        const sameContext =
          !initialVin ||
          (saved.car?.vin || saved.query || "").toUpperCase() ===
            initialVin.toUpperCase();
        if (saved?.car && sameContext) {
          restored = true;
          setQuery(saved.query || "");
          setCar(saved.car);
          modeRef.current = saved.mode === "cat" ? "cat" : "quick";
          void loadTree(saved.car);
          if (saved.leaf) void loadParts(saved.car, saved.leaf);
        }
      }
    } catch {}
    if (!restored && initialVin) {
      setQuery(initialVin);
      void runSearch(initialVin);
    } else if (!restored && initialPlate) {
      setQuery(initialPlate);
      void runPlateSearch(initialPlate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    loading === "parts" || searching || searchResults !== null || parts !== null;

  function backToTree() {
    setParts(null);
    setSelectedId(null);
    setSearchResults(null);
  }

  return (
    <div className="space-y-6">
      {/* Поиск авто по VIN */}
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
            placeholder="VIN или гос номер — например, WAUZZZ4M6JD010702 или Т500СО66"
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
              <div className="min-w-0">
                <p className="font-semibold text-white truncate">
                  {car.brand} {car.modelName}
                </p>
                <p className="text-xs text-neutral-400 truncate">
                  {car.description || car.title}
                </p>
              </div>
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

          {/* Поиск детали по названию или OEM-номеру внутри этого авто */}
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
                {loading === "parts" || searching ? (
                  <Spinner
                    label={searching ? "Ищем деталь…" : "Загружаем детали узла…"}
                  />
                ) : searchResults !== null ? (
                  <SearchResultsView
                    results={searchResults}
                    query={partQuery}
                    backVin={car.vin || car.frame || query}
                  />
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

/** Результаты поиска детали по названию/номеру — плоский список с ценами. */
function SearchResultsView({
  results,
  query,
  backVin,
}: {
  results: Array<{ number: string; name: string }>;
  query: string;
  backVin?: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-400">
        {results.length
          ? `Найдено по запросу «${query}»: ${results.length}`
          : `По запросу «${query}» ничего не найдено`}
      </p>
      {results.length > 0 && (
        <div className="divide-y divide-neutral-800 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
          {results.map((r, i) => (
            <div
              key={`${r.number}-${i}`}
              className="flex items-center gap-3 p-3 hover:bg-neutral-800/40"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-neutral-100">{r.name}</p>
                <p className="font-mono text-xs text-neutral-400">{r.number}</p>
              </div>
              <Link
                href={`/catalog?article=${encodeURIComponent(r.number)}${
                  backVin ? `&fromVin=${encodeURIComponent(backVin)}` : ""
                }`}
                className="shrink-0"
              >
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Tag className="h-3.5 w-3.5" />
                  Цены
                </Button>
              </Link>
            </div>
          ))}
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
  catalogId,
  carId,
}: {
  parts: GoodvinParts;
  backVin?: string;
  catalogId?: string;
  carId?: string;
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
          single={single}
          catalogId={catalogId}
          carId={carId}
        />
      ))}
    </div>
  );
}

/** Один узел: схема слева с кликабельными выносками, детали справа. */
function UnitBlock({
  group,
  backVin,
  single,
  catalogId,
  carId,
}: {
  group: GoodvinParts["partGroups"][number];
  backVin?: string;
  single: boolean;
  catalogId?: string;
  carId?: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img(group.img)}
                alt={group.imgDescription || "Схема узла"}
                className="block h-auto w-full select-none"
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
          </div>
        )}

        {/* Список деталей этого узла */}
        <div className="divide-y divide-neutral-800 self-start overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
          {shownParts.map((part, pi) => {
            const pos = part.positionNumber || "";
            const isActive = pos !== "" && active === pos;
            const variant = variantInfo.get(pi);
            return (
              <div
                key={`${part.id}-${pi}`}
                ref={(el) => {
                  if (pos) rowRefs.current[pos] = el;
                }}
                onClick={() => pos && selectFromList(pos)}
                className={`flex items-center gap-3 p-3 transition-colors ${
                  pos ? "cursor-pointer" : ""
                } ${
                  isActive
                    ? "bg-orange-500/10 ring-1 ring-inset ring-orange-500/50"
                    : "hover:bg-neutral-800/40"
                }`}
              >
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
                {part.number && (
                  <Link
                    href={`/catalog?article=${encodeURIComponent(part.number)}${
                      backVin ? `&fromVin=${encodeURIComponent(backVin)}` : ""
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
