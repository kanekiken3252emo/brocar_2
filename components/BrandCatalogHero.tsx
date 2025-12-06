"use client";

import Link from "next/link";

// Brands organized by columns (как на exist.ru)
const BRAND_COLUMNS = [
  {
    brands: [
      { letter: "", name: "Audi" },
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
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Brand List Grid */}
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-8 gap-y-1">
          {BRAND_COLUMNS.map((column, colIndex) => (
            <div key={colIndex} className="space-y-1">
              {column.brands.map((brand, brandIndex) => (
                <div key={brandIndex} className="flex items-start gap-2">
                  {/* Letter indicator */}
                  {brand.letter ? (
                    <span className="w-4 text-sm font-bold text-red-600 shrink-0">
                      {brand.letter}
                    </span>
                  ) : (
                    <span className="w-4 shrink-0"></span>
                  )}
                  
                  {/* Brand name */}
                  {brand.isLink ? (
                    <Link
                      href="/catalog"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {brand.name}
                    </Link>
                  ) : (
                    <span className="text-sm text-gray-700 hover:text-blue-600 cursor-pointer transition-colors">
                      {brand.name}
                    </span>
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

