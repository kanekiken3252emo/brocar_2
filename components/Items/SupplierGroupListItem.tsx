"use client";

import Link from "next/link";
import { ShoppingCart, Package, Clock, MapPin } from "lucide-react";
import type { SupplierGroup, SupplierOffer } from "@/lib/suppliers/adapter";

interface Props {
  group: SupplierGroup;
}

function formatPrice(n: number) {
  return n.toLocaleString("ru-RU");
}

function formatDelivery(days: number | null) {
  if (days == null) return "уточн.";
  if (days === 0) return "сегодня";
  if (days === 1) return "завтра";
  return `${days} дн.`;
}

function OfferRow({ offer }: { offer: SupplierOffer }) {
  return (
    <tr className="hover:bg-neutral-800/40 transition-colors">
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="inline-flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              offer.stock > 5
                ? "bg-green-500"
                : offer.stock > 0
                ? "bg-yellow-500"
                : "bg-neutral-600"
            }`}
          />
          <span className="text-white font-medium">{offer.stock} шт.</span>
        </span>
      </td>
      <td className="px-4 py-3 text-neutral-300">
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-neutral-500" />
          {offer.supplier}
        </span>
      </td>
      <td className="px-4 py-3 text-neutral-300 whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-neutral-500" />
          {formatDelivery(offer.deliveryDays)}
        </span>
      </td>
      <td className="px-4 py-3 text-right text-white font-semibold whitespace-nowrap">
        {formatPrice(offer.ourPrice)} <span className="text-neutral-500">₽</span>
      </td>
      <td className="px-4 py-3 w-12 text-right">
        <button
          onClick={(e) => {
            e.preventDefault();
            console.log("Add to cart:", offer);
          }}
          className="p-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors shadow-md shadow-orange-500/20"
          title="Добавить в корзину"
        >
          <ShoppingCart className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}

export default function SupplierGroupListItem({ group }: Props) {
  const href = `/product/${encodeURIComponent(group.article)}?brand=${encodeURIComponent(
    group.brand
  )}`;
  const uniqueSuppliers = new Set(group.offers.map((o) => o.supplierCode)).size;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden hover:border-orange-500/40 transition-colors">
      {/* Заголовок карточки — бренд / артикул / название */}
      <Link href={href}>
        <div className="group p-4 md:p-5 border-b border-neutral-800 hover:bg-neutral-800/30 transition-colors cursor-pointer">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1.5">
            <span className="text-orange-500 font-bold text-sm uppercase tracking-wide">
              {group.brand || "Без бренда"}
            </span>
            <span className="font-mono text-white font-bold text-base bg-neutral-800 px-2 py-0.5 rounded-md">
              {group.article}
            </span>
          </div>
          <h3 className="text-base text-neutral-100 group-hover:text-orange-400 transition-colors line-clamp-2">
            {group.name}
          </h3>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-neutral-500">
            <span className="inline-flex items-center gap-1">
              <Package className="w-3.5 h-3.5" />
              Всего: {group.totalStock} шт.
            </span>
            <span>
              {group.offers.length} предл. / {uniqueSuppliers} пост.
            </span>
            <span>
              от <span className="text-white font-semibold">{formatPrice(group.minPrice)} ₽</span>
            </span>
          </div>
        </div>
      </Link>

      {/* Таблица предложений по складам */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-800/50 border-b border-neutral-800">
              <th className="px-4 py-2 text-left text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                Наличие
              </th>
              <th className="px-4 py-2 text-left text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                Склад
              </th>
              <th className="px-4 py-2 text-left text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                Доставим
              </th>
              <th className="px-4 py-2 text-right text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                Цена
              </th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {group.offers.map((offer, i) => (
              <OfferRow key={`${offer.supplierCode}-${i}`} offer={offer} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
