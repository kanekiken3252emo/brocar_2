"use client";

import { useState, useEffect } from "react";
import { Brand, Model } from "@/types/car-search";
import { ChevronDown } from "lucide-react";

interface ModelSelectProps {
  selectedBrand: Brand | null;
  selectedModel: Model | null;
  onSelect: (model: Model | null) => void;
}

export default function ModelSelect({
  selectedBrand,
  selectedModel,
  onSelect,
}: ModelSelectProps) {
  const [models, setModels] = useState<Model[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedBrand) {
      loadModels(selectedBrand);
    } else {
      setModels([]);
      onSelect(null);
    }
  }, [selectedBrand]);

  const loadModels = async (brand: Brand) => {
    setLoading(true);
    try {
      const brandSlug = brand.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const response = await fetch(`/api/models/${brandSlug}.json`);
      
      if (!response.ok) {
        // If specific brand file doesn't exist, return empty
        setModels([]);
        return;
      }
      
      const data = await response.json();
      setModels(data);
    } catch (error) {
      console.error("Failed to load models:", error);
      setModels([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (model: Model) => {
    onSelect(model);
    setIsOpen(false);
  };

  const isDisabled = !selectedBrand;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !isDisabled && setIsOpen(!isOpen)}
        disabled={isDisabled}
        className={`w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-left flex items-center justify-between transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          isDisabled
            ? "opacity-50 cursor-not-allowed bg-gray-50"
            : "hover:border-blue-500"
        }`}
      >
        <span className={selectedModel ? "text-gray-900" : "text-gray-500"}>
          {selectedModel ? selectedModel.name : "Модель"}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-[400px] overflow-hidden">
            <div className="overflow-y-auto max-h-[400px] p-2">
              {loading ? (
                <div className="text-center py-8 text-gray-500">
                  Загрузка моделей...
                </div>
              ) : models.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Модели не найдены
                </div>
              ) : (
                <div className="space-y-1">
                  {models.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => handleSelect(model)}
                      className="w-full px-4 py-2 text-left hover:bg-blue-50 rounded transition-colors"
                    >
                      {model.name}
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

