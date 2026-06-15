"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Loader2,
  AlertCircle,
  ChevronRight,
  ArrowLeft,
  Car,
  Layers,
  Package,
  Home,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  GoodvinCarInfo,
  GoodvinGroup,
  GoodvinParts,
} from "@/types/goodvin";

/** Протокол-относительные ссылки картинок GoodVin → https. */
function img(src?: string): string | undefined {
  if (!src) return undefined;
  return src.startsWith("//") ? `https:${src}` : src;
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

function VinCatalogInner() {
  const searchParams = useSearchParams();

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState<
    null | "cars" | "groups" | "parts"
  >(null);
  const [error, setError] = useState("");

  const [cars, setCars] = useState<GoodvinCarInfo[]>([]);
  const [car, setCar] = useState<GoodvinCarInfo | null>(null);

  const [path, setPath] = useState<GoodvinGroup[]>([]);
  const [groups, setGroups] = useState<GoodvinGroup[]>([]);
  const [parts, setParts] = useState<GoodvinParts | null>(null);
  const [partsGroup, setPartsGroup] = useState<GoodvinGroup | null>(null);

  const loadGroups = useCallback(
    async (selectedCar: GoodvinCarInfo, groupId: string) => {
      setLoading("groups");
      setError("");
      setParts(null);
      setPartsGroup(null);
      try {
        const data = await fetchJson<{ groups: GoodvinGroup[] }>(
          `/api/goodvin/groups?catalogId=${encodeURIComponent(
            selectedCar.catalogId
          )}&carId=${encodeURIComponent(selectedCar.carId)}&groupId=${encodeURIComponent(
            groupId
          )}&criteria=${encodeURIComponent(selectedCar.criteria || "")}`
        );
        setGroups(data.groups);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(null);
      }
    },
    []
  );

  const loadParts = useCallback(
    async (selectedCar: GoodvinCarInfo, group: GoodvinGroup) => {
      setLoading("parts");
      setError("");
      try {
        const data = await fetchJson<{ parts: GoodvinParts }>(
          `/api/goodvin/parts?catalogId=${encodeURIComponent(
            selectedCar.catalogId
          )}&carId=${encodeURIComponent(selectedCar.carId)}&groupId=${encodeURIComponent(
            group.id
          )}&criteria=${encodeURIComponent(selectedCar.criteria || "")}`
        );
        setParts(data.parts);
        setPartsGroup(group);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(null);
      }
    },
    []
  );

  const selectCar = useCallback(
    (selectedCar: GoodvinCarInfo) => {
      setCar(selectedCar);
      setCars([]);
      setPath([]);
      void loadGroups(selectedCar, "");
    },
    [loadGroups]
  );

  const runSearch = useCallback(
    async (q: string) => {
      const value = q.trim();
      if (!value) return;
      setLoading("cars");
      setError("");
      setCar(null);
      setCars([]);
      setParts(null);
      setPartsGroup(null);
      setPath([]);
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
        if (data.cars.length === 1) {
          selectCar(data.cars[0]);
        } else {
          setCars(data.cars);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(null);
      }
    },
    [selectCar]
  );

  // VIN из гаража: /catalog-vin?vin=...
  useEffect(() => {
    const initial = searchParams.get("vin");
    if (initial) {
      setQuery(initial);
      void runSearch(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openGroup(g: GoodvinGroup) {
    if (!car) return;
    if (g.hasParts) {
      void loadParts(car, g);
    } else {
      setPath((p) => [...p, g]);
      void loadGroups(car, g.id);
    }
  }

  function goToCrumb(index: number) {
    if (!car) return;
    // index = -1 → корень каталога
    const newPath = index < 0 ? [] : path.slice(0, index + 1);
    setPath(newPath);
    const groupId = index < 0 ? "" : newPath[newPath.length - 1].id;
    void loadGroups(car, groupId);
  }

  function resetSearch() {
    setCar(null);
    setCars([]);
    setGroups([]);
    setParts(null);
    setPartsGroup(null);
    setPath([]);
    setError("");
  }

  return (
    <div className="space-y-6">
      {/* Поисковая строка */}
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
            {cars.map((c) => (
              <button
                key={c.carId}
                onClick={() => selectCar(c)}
                className="group flex items-start gap-4 rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-left transition-colors hover:border-orange-500/50 hover:bg-neutral-800/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-500">
                  <Car className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-white">
                    {c.brand} {c.modelName}
                  </p>
                  <p className="text-sm text-neutral-400 line-clamp-2">
                    {c.description || c.title}
                  </p>
                </div>
                <ChevronRight className="ml-auto h-5 w-5 shrink-0 self-center text-neutral-600 transition-colors group-hover:text-orange-500" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Выбранное авто + навигация по узлам */}
      {car && (
        <div className="space-y-5">
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
            <Button variant="outline" size="sm" onClick={resetSearch} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Другой VIN
            </Button>
          </div>

          {/* Хлебные крошки по узлам */}
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <button
              onClick={() => goToCrumb(-1)}
              className="inline-flex items-center gap-1 text-neutral-400 hover:text-orange-500 transition-colors"
            >
              <Home className="h-3.5 w-3.5" />
              Узлы
            </button>
            {path.map((g, i) => (
              <span key={g.id} className="inline-flex items-center gap-1.5">
                <ChevronRight className="h-3.5 w-3.5 text-neutral-600" />
                <button
                  onClick={() => goToCrumb(i)}
                  className={
                    i === path.length - 1 && !parts
                      ? "text-neutral-200"
                      : "text-neutral-400 hover:text-orange-500 transition-colors"
                  }
                >
                  {g.name}
                </button>
              </span>
            ))}
            {parts && partsGroup && (
              <span className="inline-flex items-center gap-1.5">
                <ChevronRight className="h-3.5 w-3.5 text-neutral-600" />
                <span className="text-neutral-200">{partsGroup.name}</span>
              </span>
            )}
          </div>

          {(loading === "groups" || loading === "parts") && (
            <Spinner
              label={
                loading === "parts" ? "Загружаем детали узла…" : "Загружаем узлы…"
              }
            />
          )}

          {/* Сетка узлов */}
          {!loading && !parts && groups.length > 0 && (
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => openGroup(g)}
                  className="group flex flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 text-left transition-colors hover:border-orange-500/50"
                >
                  <div
                    className={`flex aspect-[4/3] items-center justify-center p-2 ${
                      img(g.img) ? "bg-white" : "bg-neutral-800/60"
                    }`}
                  >
                    {img(g.img) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img(g.img)}
                        alt={g.name}
                        className="h-full w-full object-contain"
                        loading="lazy"
                      />
                    ) : g.hasParts ? (
                      <Package className="h-9 w-9 text-orange-500/70" />
                    ) : (
                      <Layers className="h-9 w-9 text-neutral-600" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 p-3">
                    {g.hasParts ? (
                      <Package className="h-4 w-4 shrink-0 text-orange-500" />
                    ) : (
                      <Layers className="h-4 w-4 shrink-0 text-neutral-500" />
                    )}
                    <span className="text-xs font-medium text-neutral-200 line-clamp-2 group-hover:text-white">
                      {g.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!loading && !parts && groups.length === 0 && !error && (
            <p className="py-10 text-center text-sm text-neutral-500">
              В этом узле нет вложенных групп.
            </p>
          )}

          {/* Детали узла */}
          {!loading && parts && (
            <PartsView parts={parts} />
          )}
        </div>
      )}
    </div>
  );
}

function PartsView({ parts }: { parts: GoodvinParts }) {
  // Активная позиция (номер выноски). Подсвечивает зону на схеме и деталь(и)
  // в списке. Меняется кликом по схеме или по строке детали.
  const [active, setActive] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const positions = parts.positions ?? [];
  const hasHotspots = Boolean(img(parts.img)) && positions.length > 0;

  const selectFromImage = useCallback((num: string) => {
    setActive((prev) => (prev === num ? null : num));
    const el = rowRefs.current[num];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const selectFromList = useCallback((num: string) => {
    setActive((prev) => (prev === num ? null : num));
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Схема с кликабельными выносками */}
      {img(parts.img) && (
        <div className="lg:sticky lg:top-4 self-start space-y-2">
          <div className="relative overflow-hidden rounded-xl border border-neutral-800 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img(parts.img)}
              alt={parts.imgDescription || "Схема узла"}
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
                // coordinates = [x, y, width, height] в пикселях оригинала —
                // маленький бокс на месте номера-выноски. Расширяем зону клика
                // на PAD px вокруг, чтобы по мелкому номеру было легко попасть.
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
                    key={pos.number}
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
              Номера на схеме кликабельны — нажмите, чтобы найти деталь в списке
            </p>
          )}
        </div>
      )}

      {/* Список деталей */}
      <div className="space-y-5">
        {parts.partGroups.map((pg, gi) => (
          <div key={`${pg.number}-${gi}`} className="space-y-2">
            {pg.name && (
              <p className="text-sm font-semibold text-white">{pg.name}</p>
            )}
            <div className="divide-y divide-neutral-800 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
              {pg.parts.map((part, pi) => {
                const pos = part.positionNumber || "";
                const isActive = pos !== "" && active === pos;
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
                        href={`/catalog?article=${encodeURIComponent(part.number)}`}
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
        ))}
      </div>
    </div>
  );
}

export function VinCatalog() {
  return (
    <Suspense fallback={<Spinner label="Загрузка каталога…" />}>
      <VinCatalogInner />
    </Suspense>
  );
}

export default VinCatalog;
