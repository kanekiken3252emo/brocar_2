"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, X } from "lucide-react";

// Brands grouped by letters (как на exist.ru)
const BRAND_GROUPS = {
  A: ["Audi"],
  B: ["Baic", "BMW", "ВАЗ"],
  C: ["Cadillac", "Changan", "Chery", "Chevrolet", "Citroen"],
  D: ["Daewoo"],
  E: ["Exeed"],
  F: ["FAW", "Ford"],
  G: ["Geely", "ГАЗ"],
  H: ["Haval", "Honda", "Hyundai"],
  I: ["Infiniti"],
  J: ["JAC", "Jaguar", "Jeep", "Jetour", "Jetta"],
  K: ["Kaiyi", "Kia"],
  L: ["Land Rover", "Lexus", "Livan", "Lixiang"],
  M: ["Mazda", "Mercedes", "Mitsubishi", "Москвич"],
  N: ["Nissan"],
  O: ["Omoda", "Opel"],
  P: ["Peugeot", "Porsche"],
  R: ["Renault"],
  S: ["Skoda", "Subaru", "Suzuki"],
  T: ["Tank", "Toyota"],
  U: ["УАЗ"],
  V: ["Volkswagen", "Volvo", "Voyah"],
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
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Dropdown Panel */}
      <div className="absolute left-0 right-0 top-full bg-white shadow-2xl z-50 border-t border-gray-200">
        <div className="container mx-auto px-4 py-8">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>

          {/* Title */}
          <h3 className="text-lg font-bold text-gray-900 mb-6">
            Выберите марку автомобиля
          </h3>

          {/* Brands Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
            {Object.entries(BRAND_GROUPS).map(([letter, brands]) => (
              <div key={letter}>
                {/* Letter Header */}
                <div className="text-lg font-bold text-red-600 mb-3 pb-2 border-b-2 border-red-600">
                  {letter}
                </div>
                
                {/* Brands List */}
                <ul className="space-y-2">
                  {brands.map((brand) => (
                    <li key={brand}>
                      <Link
                        href={`/catalog?brand=${encodeURIComponent(brand)}`}
                        className="text-sm text-gray-700 hover:text-blue-600 hover:underline block transition-colors"
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
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center gap-6 text-sm">
              <Link
                href="/catalog"
                className="text-blue-600 hover:underline"
                onClick={onClose}
              >
                Все каталоги
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

