"use client";

import Link from "next/link";

// Brands organized by columns
const BRAND_COLUMNS = [
  {
    brands: [
      { letter: "A", name: "Audi" },
      { letter: "B", name: "Baic" },
      { letter: "", name: "BMW" },
      { letter: "C", name: "Cadillac" },
      { letter: "", name: "Changan" },
      { letter: "", name: "Chery" },
      { letter: "", name: "Chevrolet" },
      { letter: "", name: "Citroen" },
      { letter: "D", name: "Daewoo" },
      { letter: "E", name: "Exeed" },
    ],
  },
  {
    brands: [
      { letter: "F", name: "FAW" },
      { letter: "", name: "Ford" },
      { letter: "G", name: "Geely" },
      { letter: "H", name: "Haval" },
      { letter: "", name: "Honda" },
      { letter: "", name: "Hyundai" },
      { letter: "I", name: "Infiniti" },
      { letter: "J", name: "JAC" },
      { letter: "", name: "Jaguar" },
      { letter: "", name: "Jeep" },
    ],
  },
  {
    brands: [
      { letter: "", name: "Jetour" },
      { letter: "", name: "Jetta" },
      { letter: "K", name: "Kaiyi" },
      { letter: "", name: "Kia" },
      { letter: "L", name: "Land Rover" },
      { letter: "", name: "Lexus" },
      { letter: "", name: "Livan" },
      { letter: "", name: "Lixiang" },
      { letter: "M", name: "Mazda" },
      { letter: "", name: "Mercedes" },
    ],
  },
  {
    brands: [
      { letter: "", name: "Mitsubishi" },
      { letter: "N", name: "Nissan" },
      { letter: "O", name: "Omoda" },
      { letter: "", name: "Opel" },
      { letter: "P", name: "Peugeot" },
      { letter: "", name: "Porsche" },
      { letter: "R", name: "Renault" },
      { letter: "S", name: "Skoda" },
      { letter: "", name: "Subaru" },
      { letter: "", name: "Suzuki" },
    ],
  },
  {
    brands: [
      { letter: "T", name: "Tank" },
      { letter: "", name: "Toyota" },
      { letter: "V", name: "Volkswagen" },
      { letter: "", name: "Volvo" },
      { letter: "", name: "Voyah" },
      { letter: "В", name: "ВАЗ" },
      { letter: "Г", name: "ГАЗ" },
      { letter: "М", name: "Москвич" },
      { letter: "У", name: "УАЗ" },
      { letter: "", name: "Все марки", isLink: true },
    ],
  },
];

export default function BrandCatalogHero() {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-8 gap-y-1">
          {BRAND_COLUMNS.map((column, colIndex) => (
            <div key={colIndex} className="space-y-1">
              {column.brands.map((brand, brandIndex) => (
                <div key={brandIndex} className="flex items-start gap-2">
                  {/* Letter indicator */}
                  {brand.letter ? (
                    <span className="w-5 text-sm font-bold text-orange-500 shrink-0">
                      {brand.letter}
                    </span>
                  ) : (
                    <span className="w-5 shrink-0"></span>
                  )}
                  
                  {/* Brand name */}
                  {brand.isLink ? (
                    <Link
                      href="/catalog"
                      className="text-sm text-orange-500 hover:text-orange-400 font-medium transition-colors"
                    >
                      {brand.name} →
                    </Link>
                  ) : (
                    <Link
                      href={`/catalog?brand=${encodeURIComponent(brand.name)}`}
                      className="text-sm text-neutral-400 hover:text-white transition-colors"
                    >
                      {brand.name}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
