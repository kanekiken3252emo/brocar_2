"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Car, Loader2, ChevronRight, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GoodvinCarInfo } from "@/types/goodvin";

type Brand = { code: string; brand: string; name: string; wizard: boolean };
type Step = {
  conditionId: string;
  name: string;
  determined: boolean;
  value?: string;
  options: Array<{ key: string; label: string }>;
};

/**
 * Компактный подбор автомобиля на главной: марка → модель → год → двигатель
 * (тот же мастер Laximo, что в каталоге по VIN, в сжатой форме). Выбранная
 * машина кладётся в sessionStorage (SavedNav каталога) — /catalog-vin
 * открывается сразу с деревом узлов, без повторного поиска.
 */
export default function CarPickerWidget() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [ssd, setSsd] = useState("");
  const [loading, setLoading] = useState(false);
  const [carsLoading, setCarsLoading] = useState(false);
  const [cars, setCars] = useState<GoodvinCarInfo[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/goodvin/brands")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive)
          setBrands(
            ((d?.brands ?? []) as Brand[]).filter((b) => b.wizard)
          );
      })
      .catch(() => {
        if (alive) setBrands([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const loadWizard = async (b: Brand, s: string) => {
    setLoading(true);
    setError("");
    setCars(null);
    try {
      const r = await fetch(
        `/api/goodvin/wizard?catalogId=${encodeURIComponent(
          b.code
        )}&ssd=${encodeURIComponent(s)}`
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "Ошибка каталога");
      setSteps((d.steps ?? []) as Step[]);
      setSsd(s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const pickBrand = (code: string) => {
    const b = brands?.find((x) => x.code === code) ?? null;
    setBrand(b);
    setSteps([]);
    setSsd("");
    setCars(null);
    setError("");
    if (b) void loadWizard(b, "");
  };

  const showCars = async () => {
    if (!brand || !ssd) return;
    setCarsLoading(true);
    setError("");
    try {
      const r = await fetch(
        `/api/goodvin/wizard-cars?catalogId=${encodeURIComponent(
          brand.code
        )}&ssd=${encodeURIComponent(ssd)}`
      );
      const d = await r.json();
      const list = (d?.cars ?? []) as GoodvinCarInfo[];
      if (!list.length) {
        setError("Под выбранные параметры автомобилей не нашлось — измените параметры.");
        return;
      }
      if (list.length === 1) {
        go(list[0]);
        return;
      }
      setCars(list);
    } catch {
      setError("Не удалось получить список автомобилей. Попробуйте ещё раз.");
    } finally {
      setCarsLoading(false);
    }
  };

  const go = (car: GoodvinCarInfo) => {
    // Каталог по VIN подхватит машину из sessionStorage (SavedNav).
    // handoff — одноразовая передача: без него заход на /catalog-vin без
    // параметров прошлую машину не восстанавливает.
    try {
      sessionStorage.setItem(
        "vinCatalogNav",
        JSON.stringify({ query: "", car, mode: "quick", leaf: null, handoff: true })
      );
    } catch {}
    router.push("/catalog-vin");
  };

  const selectCls =
    "w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-white transition-colors focus:border-orange-500 focus:outline-none disabled:opacity-50";

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/15 text-orange-500">
            <Car className="h-5 w-5" />
          </span>
          Подбор по параметрам — покажем схемы узлов и номера деталей
        </p>
        <Link
          href="/catalog-vin"
          className="inline-flex items-center gap-1.5 text-sm text-orange-500 transition-colors hover:text-orange-400"
        >
          <ScanLine className="h-4 w-4" />
          Знаете VIN? Найти по VIN
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-xs text-neutral-500">Марка</span>
          <select
            value={brand?.code ?? ""}
            onChange={(e) => pickBrand(e.target.value)}
            disabled={brands === null}
            className={selectCls}
          >
            <option value="">
              {brands === null ? "Загружаем марки…" : "Выберите марку"}
            </option>
            {(brands ?? []).map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

        {brand &&
          steps
            .filter((s) => s.options.length > 0 || s.determined)
            .slice(0, 7)
            .map((s) => (
              <label key={s.conditionId || s.name} className="block">
                <span className="mb-1 block text-xs text-neutral-500">
                  {s.name}
                </span>
                {s.options.length > 0 ? (
                  <select
                    value=""
                    disabled={loading}
                    onChange={(e) => {
                      if (e.target.value && brand)
                        void loadWizard(brand, e.target.value);
                    }}
                    className={selectCls}
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
                  <div className="truncate rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2.5 text-sm font-medium text-orange-300">
                    {s.value ?? "—"}
                  </div>
                )}
              </label>
            ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          onClick={() => void showCars()}
          disabled={!ssd || loading || carsLoading}
          className="gap-2"
        >
          {carsLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Car className="h-4 w-4" />
          )}
          Показать автомобили
        </Button>
        {loading && (
          <span className="inline-flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
            уточняем параметры…
          </span>
        )}
        {!ssd && !loading && brand && (
          <span className="text-sm text-neutral-500">
            Выберите модель или год — список уточнится
          </span>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {/* Найденные машины — клик открывает каталог узлов */}
      {cars && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {cars.map((c) => (
            <button
              key={`${c.catalogId}-${c.carId}-${c.criteria.slice(0, 24)}`}
              type="button"
              onClick={() => go(c)}
              className="group flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-left transition-colors hover:border-orange-500/50"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/15 text-orange-500">
                <Car className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {c.brand} {c.modelName}
                </p>
                <p className="truncate text-xs text-neutral-500">
                  {c.description}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-neutral-600 transition-colors group-hover:text-orange-500" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
