"use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, Package, Clock, Truck } from "lucide-react";
import type { SupplierGroup } from "@/lib/suppliers/adapter";

interface SupplierItemCardProps {
  group: SupplierGroup;
  showAddToCart?: boolean;
}

function formatPrice(n: number) {
  return n.toLocaleString("ru-RU");
}

export default function SupplierItemCard({
  group,
  showAddToCart = true,
}: SupplierItemCardProps) {
  const isInStock = group.totalStock > 0;
  const uniqueSuppliers = new Set(group.offers.map((o) => o.supplierCode)).size;

  const href = `/product/${encodeURIComponent(group.article)}?brand=${encodeURIComponent(
    group.brand
  )}`;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    console.log("Add to cart:", group);
  };

  return (
    <Link href={href}>
      <div className="group bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden hover:border-orange-500/50 transition-all duration-300 h-full flex flex-col hover:shadow-lg hover:shadow-orange-500/10">
        <div className="relative h-48 bg-neutral-800 flex items-center justify-center">
          <Image
            src="/photo-soon.png"
            alt={group.name || "Товар"}
            width={160}
            height={160}
            className="w-40 h-40 object-contain"
          />

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

        <div className="p-4 flex-1 flex flex-col">
          <div className="text-xs text-orange-500 font-semibold mb-1">
            {group.brand || "Неизвестный бренд"}
          </div>

          <div className="text-sm text-neutral-500 mb-2">
            Артикул:{" "}
            <span className="font-mono font-semibold text-neutral-300">
              {group.article}
            </span>
          </div>

          <h3 className="text-sm font-medium text-white mb-3 line-clamp-2 flex-1 group-hover:text-orange-500 transition-colors">
            {group.name}
          </h3>

          <div className="flex items-center gap-3 text-xs text-neutral-500 mb-3 flex-wrap">
            <div className="flex items-center gap-1">
              <Package className="w-3.5 h-3.5" />
              <span>{group.totalStock} шт.</span>
            </div>
            {group.minDeliveryDays != null && (
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>от {group.minDeliveryDays} дн.</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Truck className="w-3.5 h-3.5" />
              <span>
                {group.offers.length} предл. / {uniqueSuppliers} пост.
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
            <div>
              <div className="text-xs text-neutral-500">от</div>
              <div className="text-xl font-bold text-white">
                {formatPrice(group.minPrice)}{" "}
                <span className="text-sm text-neutral-400">₽</span>
              </div>
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
        </div>
      </div>
    </Link>
  );
}
