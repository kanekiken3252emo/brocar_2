"use client";

import Link from "next/link";
import { X } from "lucide-react";

// Brands grouped by letters
const BRAND_GROUPS = {
  A: ["Audi"],
  B: ["Baic", "BMW"],
  C: ["Cadillac", "Changan", "Chery", "Chevrolet", "Citroen"],
  D: ["Daewoo"],
  E: ["Exeed"],
  F: ["FAW", "Ford"],
  G: ["Geely"],
  H: ["Haval", "Honda", "Hyundai"],
  I: ["Infiniti"],
  J: ["JAC", "Jaguar", "Jeep", "Jetour", "Jetta"],
  K: ["Kaiyi", "Kia"],
  L: ["Land Rover", "Lexus", "Livan", "Lixiang"],
  M: ["Mazda", "Mercedes", "Mitsubishi"],
  N: ["Nissan"],
  O: ["Omoda", "Opel"],
  P: ["Peugeot", "Porsche"],
  R: ["Renault"],
  S: ["Skoda", "Subaru", "Suzuki"],
  T: ["Tank", "Toyota"],
  V: ["Volkswagen", "Volvo", "Voyah"],
  "Рус": ["ВАЗ", "ГАЗ", "Москвич", "УАЗ"],
};

interface BrandCatalogDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BrandCatalogDropdown({ isOpen, onClose }: BrandCatalogDropdownProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Dropdown Panel — fullscreen on mobile (scrollable), dropdown on desktop */}
      <div className="fixed inset-0 lg:absolute lg:inset-auto lg:left-0 lg:right-0 lg:top-full bg-neutral-900 border-t border-neutral-800 shadow-2xl z-50 animate-slide-down flex flex-col">
        {/* Sticky header with title + close (mobile-only); on desktop title is inside scrollable area */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-neutral-800 lg:hidden">
          <h3 className="text-xl font-bold text-white">Выберите марку автомобиля</h3>
          <button
            onClick={onClose}
            className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        <div className="container mx-auto px-4 py-6 lg:py-8 overflow-y-auto flex-1 overscroll-contain">
          {/* Desktop close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors hidden lg:block"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-neutral-400" />
          </button>

          {/* Desktop title */}
          <h3 className="text-xl font-bold text-white mb-8 hidden lg:block">
            Выберите марку автомобиля
          </h3>

          {/* Brands Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
            {Object.entries(BRAND_GROUPS).map(([letter, brands]) => (
              <div key={letter}>
                {/* Letter Header */}
                <div className="text-lg font-bold text-orange-500 mb-3 pb-2 border-b border-orange-500/30">
                  {letter}
                </div>
                
                {/* Brands List */}
                <ul className="space-y-2">
                  {brands.map((brand) => (
                    <li key={brand}>
                      <Link
                        href={`/catalog?brand=${encodeURIComponent(brand)}`}
                        className="text-sm text-neutral-400 hover:text-white transition-colors block py-0.5"
                        onClick={onClose}
                      >
                        {brand}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Additional Links */}
          <div className="mt-8 pt-6 border-t border-neutral-800">
            <div className="flex items-center gap-6 text-sm">
              <Link
                href="/catalog"
                className="text-orange-500 hover:text-orange-400 font-medium transition-colors"
                onClick={onClose}
              >
                Все каталоги →
              </Link>
              <Link
                href="/catalog-vin"
                className="text-neutral-400 hover:text-white transition-colors"
                onClick={onClose}
              >
                Поиск по VIN
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
