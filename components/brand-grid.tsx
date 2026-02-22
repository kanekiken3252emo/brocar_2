import Link from "next/link";

const BRANDS = [
  "Bosch", "Mann-Filter", "NGK", "Brembo", "Castrol",
  "SKF", "Sachs", "Hella", "Continental", "Michelin",
];

export function BrandGrid() {
  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-white mb-8 text-center">
          Популярные бренды
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {BRANDS.map((brand) => (
            <Link
              key={brand}
              href={`/catalog?brand=${encodeURIComponent(brand)}`}
            >
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 hover:border-orange-500/50 transition-all cursor-pointer flex items-center justify-center">
                <p className="font-semibold text-neutral-300 text-center hover:text-orange-500 transition-colors">
                  {brand}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
