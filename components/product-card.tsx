import Link from "next/link";
import { Card, CardContent, CardFooter } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ShoppingCart } from "lucide-react";

export interface Product {
  id: string;
  name: string;
  article: string;
  brand: string;
  price: number;
  image?: string;
  stock: number;
  supplier: string;
}

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Card className="h-full flex flex-col hover:shadow-lg transition-all hover:-translate-y-1 border border-gray-200 hover:border-blue-400">
      <CardContent className="p-4 flex-1">
        <Link href={`/product/${product.id}`}>
          <div className="aspect-square bg-gray-100 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                className="object-cover w-full h-full"
              />
            ) : (
              <div className="text-6xl">📦</div>
            )}
          </div>
        </Link>

        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/product/${product.id}`}>
              <h3 className="font-semibold text-gray-900 hover:text-blue-600 line-clamp-2">
                {product.name}
              </h3>
            </Link>
            {product.stock > 0 ? (
              <Badge variant="default" className="bg-green-500 shrink-0">
                В наличии
              </Badge>
            ) : (
              <Badge variant="secondary" className="shrink-0">
                Под заказ
              </Badge>
            )}
          </div>

          <p className="text-sm text-gray-600">
            Артикул: <span className="font-medium">{product.article}</span>
          </p>

          <p className="text-sm text-gray-600">
            Бренд: <span className="font-medium">{product.brand}</span>
          </p>

          <p className="text-xs text-gray-500">
            Поставщик: {product.supplier}
          </p>

          <div className="pt-2">
            <p className="text-2xl font-bold text-blue-600">
              {product.price.toLocaleString("ru-RU")} ₽
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <Button className="w-full bg-blue-600 hover:bg-blue-700" size="lg">
          <ShoppingCart className="h-4 w-4 mr-2" />
          В корзину
        </Button>
      </CardFooter>
    </Card>
  );
}

