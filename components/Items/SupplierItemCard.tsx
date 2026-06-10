"use client";

import Link from "next/link";
import { ShoppingCart, Package, Clock, Truck } from "lucide-react";
import type { SupplierGroup } from "@/lib/suppliers/adapter";
import { addSupplierItemToCart } from "@/lib/cart/client";
import ProductImage from "@/components/Items/ProductImage";
import { formatDeliveryDays } from "@/lib/utils";

interface SupplierItemCardProps {
  group: SupplierGroup;
  showAddToCart?: boolean;
  /**
   * priority=true для первых 4-8 карточек на странице каталога — даёт
   * Next.js preload-подсказку для LCP-картинки и отключает lazy-load.
   */
  priority?: boolean;
}

function formatPrice(n: number) {
  return n.toLocaleString("ru-RU");
}

export default function SupplierItemCard({
  group,
  showAddToCart = true,
  priority = false,
}: SupplierItemCardProps) {
  const isInStock = group.totalStock > 0;
  const uniqueSuppliers = new Set(group.offers.map((o) => o.supplierCode)).size;

  const href = `/product/${encodeURIComponent(group.article)}?brand=${encodeURIComponent(
    group.brand
  )}`;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const bestOffer = group.offers[0];
    if (!bestOffer) return;
    try {
      await addSupplierItemToCart({
        article: group.article,
        brand: group.brand,
        name: group.name,
        ourPrice: bestOffer.ourPrice,
        supplierPrice: bestOffer.price,
        stock: group.totalStock,
      });
    } catch (err: any) {
      window.dispatchEvent(
        new CustomEvent("cart:error", {
          detail: { message: err?.message || "Не удалось добавить" },
        })
      );
    }
  };

  return (
    <Link href={href}>
      <div className="group bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden hover:border-orange-500/50 transition-all duration-300 h-full flex flex-col hover:shadow-lg hover:shadow-orange-500/10">
        <ProductImage
          brand={group.brand}
          article={group.article}
          alt={group.name || "Товар"}
          className="h-40 md:h-44 w-full"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          priority={priority}
        />

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
                <span>
                  {group.minDeliveryDays === 0
                    ? formatDeliveryDays(0)
                    : `от ${group.minDeliveryDays} дн.`}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Truck className="w-3.5 h-3.5" />
              <span>
                {group.offers.length} предл. / {uniqueSuppliers} скл.
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
