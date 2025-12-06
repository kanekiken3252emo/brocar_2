"use client";

import { useState, useEffect } from "react";
import { Model, Modification, Engine } from "@/types/car-search";
import { ChevronDown } from "lucide-react";

interface ModificationSelectProps {
  selectedModel: Model | null;
  selectedModification: Modification | null;
  selectedEngine: Engine | null;
  selectedYear: number | null;
  onSelectModification: (modification: Modification | null) => void;
  onSelectEngine: (engine: Engine | null) => void;
  onSelectYear: (year: number | null) => void;
}

export default function ModificationSelect({
  selectedModel,
  selectedModification,
  selectedEngine,
  selectedYear,
  onSelectModification,
  onSelectEngine,
  onSelectYear,
}: ModificationSelectProps) {
  const [modifications, setModifications] = useState<Modification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedModel) {
      loadModifications(selectedModel);
    } else {
      setModifications([]);
      onSelectModification(null);
      onSelectEngine(null);
      onSelectYear(null);
    }
  }, [selectedModel]);

  const loadModifications = async (model: Model) => {
    setLoading(true);
    try {
      const modelSlug = model.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const response = await fetch(`/api/modifications/${modelSlug}.json`);
      
      if (!response.ok) {
        setModifications([]);
        return;
      }
      
      const data = await response.json();
      setModifications(data);
    } catch (error) {
      console.error("Failed to load modifications:", error);
      setModifications([]);
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = !selectedModel;

  // Get available years for selected modification
  const availableYears = selectedModification
    ? Array.from(
        { length: selectedModification.yearTo - selectedModification.yearFrom + 1 },
        (_, i) => selectedModification.yearFrom + i
      ).reverse()
    : [];

  return (
    <div className="space-y-3">
      {/* Modification/Generation Select */}
      <ModificationDropdown
        modifications={modifications}
        selectedModification={selectedModification}
        onSelect={onSelectModification}
        loading={loading}
        disabled={isDisabled}
      />

      {/* Year Select */}
      <YearDropdown
        years={availableYears}
        selectedYear={selectedYear}
        onSelect={onSelectYear}
        disabled={!selectedModification}
      />

      {/* Engine Select */}
      <EngineDropdown
        engines={selectedModification?.engines || []}
        selectedEngine={selectedEngine}
        onSelect={onSelectEngine}
        disabled={!selectedModification}
      />
    </div>
  );
}

// Modification Dropdown Component
function ModificationDropdown({
  modifications,
  selectedModification,
  onSelect,
  loading,
  disabled,
}: {
  modifications: Modification[];
  selectedModification: Modification | null;
  onSelect: (mod: Modification | null) => void;
  loading: boolean;
  disabled: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-left flex items-center justify-between transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          disabled
            ? "opacity-50 cursor-not-allowed bg-gray-50"
            : "hover:border-blue-500"
        }`}
      >
        <span className={selectedModification ? "text-gray-900" : "text-gray-500"}>
          {selectedModification ? selectedModification.name : "Поколение"}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-[300px] overflow-hidden">
            <div className="overflow-y-auto max-h-[300px] p-2">
              {loading ? (
                <div className="text-center py-8 text-gray-500">Загрузка...</div>
              ) : modifications.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Поколения не найдены
                </div>
              ) : (
                <div className="space-y-1">
                  {modifications.map((mod) => (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => {
                        onSelect(mod);
                        setIsOpen(false);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-blue-50 rounded transition-colors"
                    >
                      <div className="font-medium">{mod.name}</div>
                      <div className="text-sm text-gray-500">
                        {mod.yearFrom}-{mod.yearTo === 2024 ? "н.в." : mod.yearTo}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Year Dropdown Component
function YearDropdown({
  years,
  selectedYear,
  onSelect,
  disabled,
}: {
  years: number[];
  selectedYear: number | null;
  onSelect: (year: number | null) => void;
  disabled: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-left flex items-center justify-between transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          disabled
            ? "opacity-50 cursor-not-allowed bg-gray-50"
            : "hover:border-blue-500"
        }`}
      >
        <span className={selectedYear ? "text-gray-900" : "text-gray-500"}>
          {selectedYear ? `${selectedYear} год` : "Год выпуска"}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-[250px] overflow-hidden">
            <div className="overflow-y-auto max-h-[250px] p-2">
              <div className="space-y-1">
                {years.map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => {
                      onSelect(year);
                      setIsOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-blue-50 rounded transition-colors"
                  >
                    {year} год
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Engine Dropdown Component
function EngineDropdown({
  engines,
  selectedEngine,
  onSelect,
  disabled,
}: {
  engines: Engine[];
  selectedEngine: Engine | null;
  onSelect: (engine: Engine | null) => void;
  disabled: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-left flex items-center justify-between transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          disabled
            ? "opacity-50 cursor-not-allowed bg-gray-50"
            : "hover:border-blue-500"
        }`}
      >
        <span className={selectedEngine ? "text-gray-900" : "text-gray-500"}>
          {selectedEngine ? selectedEngine.name : "Двигатель"}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-[300px] overflow-hidden">
            <div className="overflow-y-auto max-h-[300px] p-2">
              <div className="space-y-1">
                {engines.map((engine) => (
                  <button
                    key={engine.id}
                    type="button"
                    onClick={() => {
                      onSelect(engine);
                      setIsOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-blue-50 rounded transition-colors"
                  >
                    <div className="font-medium">{engine.name}</div>
                    <div className="text-sm text-gray-500">{engine.fuel}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

