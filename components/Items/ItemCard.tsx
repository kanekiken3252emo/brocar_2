"use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, Package, Clock, TrendingUp } from "lucide-react";
import type { BergResource } from "@/types/berg-api";

interface ItemCardProps {
  resource: BergResource;
  showAddToCart?: boolean;
}

export default function ItemCard({ resource, showAddToCart = true }: ItemCardProps) {
  // Calculate best offer
  const bestOffer = resource.offers?.reduce((best, current) => {
    if (!best) return current;
    if (current.price < best.price && current.reliability >= 80) {
      return current;
    }
    return best;
  }, resource.offers[0]);

  const minPrice = resource.offers?.length
    ? Math.min(...resource.offers.map((o) => o.price))
    : null;

  const totalStock = resource.offers?.reduce(
    (sum, offer) => sum + offer.quantity,
    0
  ) || 0;

  const isInStock = totalStock > 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    console.log("Add to cart:", resource);
  };

  return (
    <Link href={`/product/${resource.id}`}>
      <div className="group bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden hover:border-orange-500/50 transition-all duration-300 h-full flex flex-col hover:shadow-lg hover:shadow-orange-500/10">
        {/* Image Section */}
        <div className="relative h-48 bg-neutral-800 flex items-center justify-center">
          <Image
            src="/photo-soon.png"
            alt={resource.name || "Товар"}
            width={160}
            height={160}
            className="w-40 h-40 object-contain"
          />

          {/* Stock Badge */}
          {isInStock ? (
            <div className="absolute top-3 right-3 bg-green-500/20 text-green-400 border border-green-500/30 text-xs font-semibold px-2.5 py-1 rounded-lg">
              В наличии
            </div>
          ) : (
            <div className="absolute top-3 right-3 bg-neutral-700/50 text-neutral-400 border border-neutral-600 text-xs font-semibold px-2.5 py-1 rounded-lg">
              Под заказ
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="p-4 flex-1 flex flex-col">
          {/* Brand */}
          <div className="text-xs text-orange-500 font-semibold mb-1">
            {resource.brand?.name || "Неизвестный бренд"}
          </div>

          {/* Article Number */}
          <div className="text-sm text-neutral-500 mb-2">
            Артикул: <span className="font-mono font-semibold text-neutral-300">{resource.article}</span>
          </div>

          {/* Name */}
          <h3 className="text-sm font-medium text-white mb-3 line-clamp-2 flex-1 group-hover:text-orange-500 transition-colors">
            {resource.name}
          </h3>

          {/* Stock Info */}
          <div className="flex items-center gap-3 text-xs text-neutral-500 mb-4">
            <div className="flex items-center gap-1">
              <Package className="w-3.5 h-3.5" />
              <span>{totalStock > 0 ? `${totalStock} шт.` : "Под заказ"}</span>
            </div>
            {bestOffer && bestOffer.average_period > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{bestOffer.average_period} дн.</span>
              </div>
            )}
          </div>

          {/* Price and Action */}
          <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
            <div>
              {minPrice ? (
                <div>
                  <div className="text-xs text-neutral-500">от</div>
                  <div className="text-xl font-bold text-white">
                    {minPrice.toLocaleString("ru-RU")} <span className="text-sm text-neutral-400">₽</span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-neutral-500">Цена по запросу</div>
              )}
            </div>

            {showAddToCart && isInStock && (
              <button
                onClick={handleAddToCart}
                className="p-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-colors shadow-lg shadow-orange-500/25"
                title="Добавить в корзину"
              >
                <ShoppingCart className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Reliability Indicator */}
          {bestOffer && (
            <div className="mt-3 flex items-center gap-2">
              <TrendingUp className="w-3 h-3 text-neutral-600" />
              <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    bestOffer.reliability >= 90
                      ? "bg-green-500"
                      : bestOffer.reliability >= 70
                      ? "bg-yellow-500"
                      : "bg-red-500"
                  }`}
                  style={{ width: `${bestOffer.reliability}%` }}
                />
              </div>
              <span className="text-xs text-neutral-500">{bestOffer.reliability}%</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
