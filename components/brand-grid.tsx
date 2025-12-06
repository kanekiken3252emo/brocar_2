import { Card } from "./ui/card";

const BRANDS = [
  { name: "Bosch", logo: "🔧" },
  { name: "Mann", logo: "🔩" },
  { name: "Lukoil", logo: "🛢️" },
  { name: "Brembo", logo: "⚙️" },
  { name: "Castrol", logo: "🛢️" },
  { name: "SKF", logo: "⚡" },
  { name: "Sachs", logo: "🔧" },
  { name: "Hella", logo: "💡" },
  { name: "Continental", logo: "🚗" },
  { name: "Michelin", logo: "🛞" },
];

export function BrandGrid() {
  return (
    <section className="py-12 bg-[#f7f7f8]">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Популярные бренды
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {BRANDS.map((brand) => (
            <Card
              key={brand.name}
              className="p-6 hover:shadow-lg transition-shadow cursor-pointer bg-white border border-gray-200 hover:border-blue-400"
            >
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="text-4xl">{brand.logo}</div>
                <p className="font-semibold text-gray-800 text-center">
                  {brand.name}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

