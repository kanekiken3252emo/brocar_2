import { ProductCard, Product } from "./product-card";

interface ProductGridProps {
  products: Product[];
  title?: string;
}

export function ProductGrid({ products, title = "Рекомендуемые товары" }: ProductGridProps) {
  return (
    <section className="py-12 bg-[#f7f7f8]">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          {title}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}

