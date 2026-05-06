"use client";

import { useState, useEffect } from "react";
import { Brand } from "@/types/car-search";
import { ChevronDown, Search } from "lucide-react";

interface BrandSelectProps {
  selectedBrand: Brand | null;
  onSelect: (brand: Brand | null) => void;
}

export default function BrandSelect({ selectedBrand, onSelect }: BrandSelectProps) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBrands();
  }, []);

  const loadBrands = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/brands.json");
      const data = await response.json();
      setBrands(data);
    } catch (error) {
      console.error("Failed to load brands:", error);
    } finally {
      setLoading(false);
    }
  };

  // Group brands by letter
  const groupedBrands = brands.reduce((acc, brand) => {
    const letter = brand.letter.toUpperCase();
    if (!acc[letter]) {
      acc[letter] = [];
    }
    acc[letter].push(brand);
    return acc;
  }, {} as Record<string, Brand[]>);

  // Filter brands by search term
  const filteredBrands = searchTerm
    ? brands.filter((b) =>
        b.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : brands;

  const handleSelect = (brand: Brand) => {
    onSelect(brand);
    setIsOpen(false);
    setSearchTerm("");
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-left flex items-center justify-between hover:border-blue-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span className={selectedBrand ? "text-gray-900" : "text-gray-500"}>
          {selectedBrand ? selectedBrand.name : "Марка"}
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
          <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-[500px] overflow-hidden">
            {/* Search input */}
            <div className="sticky top-0 p-3 bg-white border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Поиск марки..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
            </div>

            {/* Brands list */}
            <div className="overflow-y-auto max-h-[400px] p-2">
              {loading ? (
                <div className="text-center py-8 text-gray-500">
                  Загрузка...
                </div>
              ) : searchTerm ? (
                // Filtered list
                <div className="space-y-1">
                  {filteredBrands.map((brand) => (
                    <button
                      key={brand.id}
                      type="button"
                      onClick={() => handleSelect(brand)}
                      className="w-full px-4 py-2 text-left hover:bg-blue-50 rounded transition-colors"
                    >
                      {brand.name}
                    </button>
                  ))}
                  {filteredBrands.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      Марка не найдена
                    </div>
                  )}
                </div>
              ) : (
                // Grouped by letter
                <div className="space-y-4">
                  {Object.keys(groupedBrands)
                    .sort()
                    .map((letter) => (
                      <div key={letter}>
                        <div className="sticky top-0 px-4 py-2 bg-gray-100 text-sm font-bold text-gray-700">
                          {letter}
                        </div>
                        <div className="space-y-1 mt-1">
                          {groupedBrands[letter].map((brand) => (
                            <button
                              key={brand.id}
                              type="button"
                              onClick={() => handleSelect(brand)}
                              className="w-full px-4 py-2 text-left hover:bg-blue-50 rounded transition-colors"
                            >
                              {brand.name}
                            </button>
                          ))}
                        </div>
                      </div>
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

