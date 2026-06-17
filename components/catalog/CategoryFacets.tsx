"use client";

import { ChevronDown, SlidersHorizontal, X } from "lucide-react";

export interface FacetOption {
  value: string;
  count: number;
}

export interface Facet {
  key: string;
  label: string;
  options: FacetOption[];
}

interface Props {
  facets: Facet[];
  /** Текущие выбранные значения: { [facet.key]: value }. */
  values: Record<string, string>;
  /** value="" — сбросить этот фасет. */
  onChange: (key: string, value: string) => void;
  onReset: () => void;
  /** Фильтр по производителю (бренду запчасти) — в сайдбаре над характеристиками. */
  brandOptions?: string[];
  brandValue?: string;
  onBrandChange?: (value: string) => void;
}

/**
 * Динамический сайдбар фасетных фильтров для страницы категории.
 * Список фасетов и их значения приходят с сервера (/api/catalog/category),
 * поэтому компонент не знает заранее, какие атрибуты есть у категории —
 * для масел это Тип/Вязкость/Объём, для других категорий будет своё.
 */
export default function CategoryFacets({
  facets,
  values,
  onChange,
  onReset,
  brandOptions,
  brandValue = "",
  onBrandChange,
}: Props) {
  const showBrand = Boolean(onBrandChange) && (brandOptions?.length ?? 0) > 1;
  const activeCount =
    Object.values(values).filter(Boolean).length + (brandValue ? 1 : 0);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 md:p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-orange-500" />
          <h3 className="text-sm font-semibold text-white uppercase tracking-wide">
            Подбор
          </h3>
        </div>
        {activeCount > 0 && (
          <button
            onClick={onReset}
            className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-orange-400 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Сбросить
          </button>
        )}
      </div>

      <div className="space-y-4">
        {showBrand && (
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">
              Производитель
            </label>
            <div className="relative">
              <select
                value={brandValue}
                onChange={(e) => onBrandChange?.(e.target.value)}
                className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-white appearance-none focus:border-orange-500 focus:outline-none transition-colors"
              >
                <option value="">Все</option>
                {brandOptions?.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
            </div>
          </div>
        )}

        {facets.map((f) => {
          const selected = values[f.key] || "";
          // Если выбранное значение выпало из текущих опций (его счётчик стал 0
          // из-за других фильтров) — всё равно показываем его, чтобы select не
          // обнулялся визуально и фильтр можно было снять.
          const opts =
            selected && !f.options.some((o) => o.value === selected)
              ? [{ value: selected, count: 0 }, ...f.options]
              : f.options;
          const disabled = opts.length === 0;

          return (
            <div key={f.key}>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                {f.label}
              </label>
              <div className="relative">
                <select
                  value={selected}
                  onChange={(e) => onChange(f.key, e.target.value)}
                  disabled={disabled}
                  className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-white appearance-none focus:border-orange-500 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Любой</option>
                  {opts.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.value}
                      {o.count > 0 ? ` (${o.count})` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
