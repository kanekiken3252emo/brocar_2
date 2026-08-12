"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

interface SavedNav {
  query: string;
  car: GoodvinCarInfo;
  leaf: { id: string; name: string } | null;
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

export function VinCatalog({ initialVin }: { initialVin?: string }) {
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
  const [parts, setParts] = useState<GoodvinParts | null>(null);

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
      const data = await fetchJson<{ tree: GoodvinGroupNode[] }>(
        `/api/goodvin/tree?catalogId=${encodeURIComponent(
          selectedCar.catalogId
        )}&carId=${encodeURIComponent(
          selectedCar.carId
        )}&criteria=${encodeURIComponent(selectedCar.criteria || "")}`
      );
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
    async (selectedCar: GoodvinCarInfo, leaf: { id: string; name: string }) => {
      setLoading("parts");
      setError("");
      setSearchResults(null); // выбор узла в дереве убирает результаты поиска
      setSelectedId(leaf.id);
      setSelectedName(leaf.name);
      try {
        const data = await fetchJson<{ parts: GoodvinParts }>(
          `/api/goodvin/parts?catalogId=${encodeURIComponent(
            selectedCar.catalogId
          )}&carId=${encodeURIComponent(
            selectedCar.carId
          )}&groupId=${encodeURIComponent(
            leaf.id
          )}&criteria=${encodeURIComponent(selectedCar.criteria || "")}`
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
      if (car) void loadParts(car, { id: node.id, name: node.name });
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

  const runSearch = useCallback(
    async (q: string) => {
      const value = q.trim();
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
      try {
        const data = await fetchJson<{ cars: GoodvinCarInfo[] }>(
          `/api/goodvin/car-info?q=${encodeURIComponent(value)}`
        );
        if (!data.cars.length) {
          setError(
            "По этому VIN/Frame ничего не найдено. Проверьте номер или воспользуйтесь подбором по марке/модели."
          );
          return;
        }
        if (data.cars.length === 1) selectCar(data.cars[0]);
        else setCars(data.cars);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(null);
      }
    },
    [selectCar]
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
          void loadTree(saved.car);
          if (saved.leaf) void loadParts(saved.car, saved.leaf);
        }
      }
    } catch {}
    if (!restored && initialVin) {
      setQuery(initialVin);
      void runSearch(initialVin);
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
        leaf: selectedId ? { id: selectedId, name: selectedName } : null,
      };
      sessionStorage.setItem(NAV_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {}
  }, [car, selectedId, selectedName, query]);

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
  }

  const visibleTop = tree.filter((n) => nodeMatches(n, filter));

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
            placeholder="Введите VIN или Frame — например, XW8AN2NE3JH035743"
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

      {/* Выбранное авто + дерево слева, детали справа */}
      {car && (
        <div className="space-y-4">
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
              {/* Дерево узлов слева */}
              <aside className="rounded-xl border border-neutral-800 bg-neutral-900 lg:sticky lg:top-4 self-start">
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

              {/* Панель деталей справа */}
              <div className="min-w-0">
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
}: {
  parts: GoodvinParts;
  backVin?: string;
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
          key={`${g.number}-${i}`}
          group={g}
          backVin={backVin}
          single={single}
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
}: {
  group: GoodvinParts["partGroups"][number];
  backVin?: string;
  single: boolean;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const positions = group.positions ?? [];
  const hasHotspots = Boolean(img(group.img)) && positions.length > 0;

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
  for (const p of group.parts) {
    const k = p.positionNumber || "";
    if (k) posCounts.set(k, (posCounts.get(k) ?? 0) + 1);
  }
  const variantSeen = new Map<string, number>();
  const variantInfo = new Map<number, { index: number; total: number }>();
  group.parts.forEach((p, pi) => {
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
          {group.parts.map((part, pi) => {
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
        </div>
      </div>
    </div>
  );
}

export default VinCatalog;
