"use client";

import { X } from "lucide-react";
import { Brand, Model, Modification, Engine } from "@/types/car-search";
import BrandSelect from "./BrandSelect";
import ModelSelect from "./ModelSelect";
import ModificationSelect from "./ModificationSelect";

interface MobileModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBrand: Brand | null;
  selectedModel: Model | null;
  selectedModification: Modification | null;
  selectedEngine: Engine | null;
  selectedYear: number | null;
  onSelectBrand: (brand: Brand | null) => void;
  onSelectModel: (model: Model | null) => void;
  onSelectModification: (modification: Modification | null) => void;
  onSelectEngine: (engine: Engine | null) => void;
  onSelectYear: (year: number | null) => void;
  onSearch: () => void;
}

export default function MobileModal({
  isOpen,
  onClose,
  selectedBrand,
  selectedModel,
  selectedModification,
  selectedEngine,
  selectedYear,
  onSelectBrand,
  onSelectModel,
  onSelectModification,
  onSelectEngine,
  onSelectYear,
  onSearch,
}: MobileModalProps) {
  if (!isOpen) return null;

  const handleSearch = () => {
    onSearch();
    onClose();
  };

  const canSearch =
    selectedBrand &&
    selectedModel &&
    selectedModification &&
    selectedEngine &&
    selectedYear;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Выбор автомобиля</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <BrandSelect selectedBrand={selectedBrand} onSelect={onSelectBrand} />
          
          <ModelSelect
            selectedBrand={selectedBrand}
            selectedModel={selectedModel}
            onSelect={onSelectModel}
          />
          
          <ModificationSelect
            selectedModel={selectedModel}
            selectedModification={selectedModification}
            selectedEngine={selectedEngine}
            selectedYear={selectedYear}
            onSelectModification={onSelectModification}
            onSelectEngine={onSelectEngine}
            onSelectYear={onSelectYear}
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleSearch}
            disabled={!canSearch}
            className="w-full py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {canSearch ? "Найти запчасти" : "Выберите автомобиль"}
          </button>
        </div>
      </div>
    </div>
  );
}

