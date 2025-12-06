"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brand, Model, Modification, Engine } from "@/types/car-search";
import { Car, Search as SearchIcon } from "lucide-react";
import BrandSelect from "./BrandSelect";
import ModelSelect from "./ModelSelect";
import ModificationSelect from "./ModificationSelect";
import VinSearch from "./VinSearch";
import MobileModal from "./MobileModal";

export default function SearchAuto() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"catalog" | "vin">("catalog");

  // Car selection state
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [selectedModification, setSelectedModification] =
    useState<Modification | null>(null);
  const [selectedEngine, setSelectedEngine] = useState<Engine | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [vin, setVin] = useState("");

  // Mobile modal
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);

  // Reset dependent selections when parent changes
  const handleBrandSelect = (brand: Brand | null) => {
    setSelectedBrand(brand);
    setSelectedModel(null);
    setSelectedModification(null);
    setSelectedEngine(null);
    setSelectedYear(null);
  };

  const handleModelSelect = (model: Model | null) => {
    setSelectedModel(model);
    setSelectedModification(null);
    setSelectedEngine(null);
    setSelectedYear(null);
  };

  const handleModificationSelect = (modification: Modification | null) => {
    setSelectedModification(modification);
    setSelectedEngine(null);
    setSelectedYear(null);
  };

  // Search handlers
  const handleCatalogSearch = () => {
    if (!selectedBrand || !selectedModel || !selectedModification || !selectedEngine || !selectedYear) {
      return;
    }

    const params = new URLSearchParams({
      brand: selectedBrand.name,
      brandId: selectedBrand.id.toString(),
      model: selectedModel.name,
      modelId: selectedModel.id.toString(),
      generation: selectedModification.generation,
      year: selectedYear.toString(),
      engine: selectedEngine.name,
      engineId: selectedEngine.id.toString(),
    });

    router.push(`/catalog?${params.toString()}`);
  };

  const handleVinSearch = () => {
    if (!vin.trim()) return;
    router.push(`/catalog?vin=${encodeURIComponent(vin)}`);
  };

  const canSearch =
    selectedBrand &&
    selectedModel &&
    selectedModification &&
    selectedEngine &&
    selectedYear;

  return (
    <>
      {/* Desktop/Tablet Version */}
      <div className="hidden lg:block bg-white rounded-lg shadow-md p-6">
        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("catalog")}
            className={`pb-3 px-4 font-medium transition-colors relative ${
              activeTab === "catalog"
                ? "text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <Car className="w-5 h-5" />
              Подбор по автомобилю
            </div>
            {activeTab === "catalog" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("vin")}
            className={`pb-3 px-4 font-medium transition-colors relative ${
              activeTab === "vin"
                ? "text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <SearchIcon className="w-5 h-5" />
              Поиск по VIN
            </div>
            {activeTab === "vin" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>
        </div>

        {/* Content */}
        {activeTab === "catalog" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-1">
                <BrandSelect
                  selectedBrand={selectedBrand}
                  onSelect={handleBrandSelect}
                />
              </div>
              <div className="md:col-span-1">
                <ModelSelect
                  selectedBrand={selectedBrand}
                  selectedModel={selectedModel}
                  onSelect={handleModelSelect}
                />
              </div>
              <div className="md:col-span-3">
                <ModificationSelect
                  selectedModel={selectedModel}
                  selectedModification={selectedModification}
                  selectedEngine={selectedEngine}
                  selectedYear={selectedYear}
                  onSelectModification={handleModificationSelect}
                  onSelectEngine={setSelectedEngine}
                  onSelectYear={setSelectedYear}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleCatalogSearch}
                disabled={!canSearch}
                className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <SearchIcon className="w-5 h-5" />
                Найти запчасти
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            <VinSearch
              vin={vin}
              onVinChange={setVin}
              onSearch={handleVinSearch}
            />
            <p className="text-sm text-gray-500 mt-3">
              VIN-номер — это уникальный 17-значный код автомобиля. Обычно
              находится в техпаспорте или на кузове авто.
            </p>
          </div>
        )}
      </div>

      {/* Mobile Version - Compact Button */}
      <div className="lg:hidden">
        <button
          onClick={() => setIsMobileModalOpen(true)}
          className="w-full bg-white border border-gray-300 rounded-lg p-4 flex items-center justify-between hover:border-blue-500 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Car className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-left">
              <div className="text-sm font-medium text-gray-900">
                {selectedBrand
                  ? `${selectedBrand.name}${selectedModel ? ` ${selectedModel.name}` : ""}`
                  : "Выбрать автомобиль"}
              </div>
              <div className="text-xs text-gray-500">
                {selectedModification
                  ? selectedModification.generation
                  : "Марка, модель, год"}
              </div>
            </div>
          </div>
          <SearchIcon className="w-5 h-5 text-gray-400" />
        </button>

        {/* VIN Search on Mobile */}
        <div className="mt-3">
          <VinSearch
            vin={vin}
            onVinChange={setVin}
            onSearch={handleVinSearch}
          />
        </div>
      </div>

      {/* Mobile Modal */}
      <MobileModal
        isOpen={isMobileModalOpen}
        onClose={() => setIsMobileModalOpen(false)}
        selectedBrand={selectedBrand}
        selectedModel={selectedModel}
        selectedModification={selectedModification}
        selectedEngine={selectedEngine}
        selectedYear={selectedYear}
        onSelectBrand={handleBrandSelect}
        onSelectModel={handleModelSelect}
        onSelectModification={handleModificationSelect}
        onSelectEngine={setSelectedEngine}
        onSelectYear={setSelectedYear}
        onSearch={handleCatalogSearch}
      />
    </>
  );
}

