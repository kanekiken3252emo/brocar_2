"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, Package, Clock, TrendingUp } from "lucide-react";
import type { BergResource, BergOffer } from "@/types/berg-api";

interface ItemCardProps {
  resource: BergResource;
  showAddToCart?: boolean;
}

export default function ItemCard({ resource, showAddToCart = true }: ItemCardProps) {
  // Calculate best offer
  const bestOffer = resource.offers?.reduce((best, current) => {
    if (!best) return current;
    // Prefer lower price with good reliability
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
    // TODO: Implement add to cart functionality
    console.log("Add to cart:", resource);
  };

  return (
    <Link href={`/product/${resource.id}`}>
      <div className="bg-white border border-gray-200 rounded-lg hover:shadow-xl transition-all duration-200 h-full flex flex-col group">
        {/* Image Section */}
        <div className="relative h-48 bg-gray-50 rounded-t-lg overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Placeholder image - replace with actual image if available */}
            <div className="w-32 h-32 bg-gray-200 rounded-lg flex items-center justify-center">
              <Package className="w-16 h-16 text-gray-400" />
            </div>
          </div>

          {/* Stock Badge */}
          {isInStock ? (
            <div className="absolute top-3 right-3 bg-green-500 text-white text-xs font-semibold px-2 py-1 rounded">
              В наличии
            </div>
          ) : (
            <div className="absolute top-3 right-3 bg-gray-400 text-white text-xs font-semibold px-2 py-1 rounded">
              Под заказ
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="p-4 flex-1 flex flex-col">
          {/* Brand */}
          <div className="text-xs text-blue-600 font-semibold mb-1">
            {resource.brand?.name || "Неизвестный бренд"}
          </div>

          {/* Article Number */}
          <div className="text-sm text-gray-500 mb-2">
            Артикул: <span className="font-mono font-semibold">{resource.article}</span>
          </div>

          {/* Name */}
          <h3 className="text-sm font-medium text-gray-900 mb-3 line-clamp-2 flex-1">
            {resource.name}
          </h3>

          {/* Stock Info */}
          <div className="flex items-center gap-2 text-xs text-gray-600 mb-3">
            <Package className="w-4 h-4" />
            <span>
              {totalStock > 0 ? `${totalStock} шт.` : "Под заказ"}
            </span>
            {bestOffer && bestOffer.average_period > 0 && (
              <>
                <Clock className="w-4 h-4 ml-2" />
                <span>{bestOffer.average_period} дн.</span>
              </>
            )}
          </div>

          {/* Price and Action */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
            <div>
              {minPrice ? (
                <div>
                  <div className="text-xs text-gray-500">от</div>
                  <div className="text-xl font-bold text-gray-900">
                    {minPrice.toLocaleString("ru-RU")} ₽
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">Цена по запросу</div>
              )}
            </div>

            {showAddToCart && isInStock && (
              <button
                onClick={handleAddToCart}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                title="Добавить в корзину"
              >
                <ShoppingCart className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Reliability Indicator */}
          {bestOffer && (
            <div className="mt-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-gray-400" />
              <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    bestOffer.reliability >= 90
                      ? "bg-green-500"
                      : bestOffer.reliability >= 70
                      ? "bg-yellow-500"
                      : "bg-red-500"
                  }`}
                  style={{ width: `${bestOffer.reliability}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">{bestOffer.reliability}%</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

