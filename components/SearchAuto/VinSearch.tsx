"use client";

import { useState } from "react";
import { Search } from "lucide-react";

interface VinSearchProps {
  vin: string;
  onVinChange: (vin: string) => void;
  onSearch: () => void;
}

export default function VinSearch({ vin, onVinChange, onSearch }: VinSearchProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (vin.trim()) {
      onSearch();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div
        className={`relative flex items-center bg-white border rounded-lg transition-all ${
          isFocused
            ? "border-blue-500 ring-2 ring-blue-500 ring-opacity-20"
            : "border-gray-300"
        }`}
      >
        <input
          type="text"
          value={vin}
          onChange={(e) => onVinChange(e.target.value.toUpperCase())}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Введите VIN-номер"
          maxLength={17}
          className="flex-1 px-4 py-3 rounded-l-lg focus:outline-none text-gray-900"
        />
        <button
          type="submit"
          disabled={!vin.trim()}
          className="px-6 py-3 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Search className="w-5 h-5" />
          <span className="hidden md:inline">Найти</span>
        </button>
      </div>
      {vin && vin.length < 17 && (
        <p className="text-xs text-gray-500 mt-1 px-1">
          Введено символов: {vin.length}/17
        </p>
      )}
    </form>
  );
}

