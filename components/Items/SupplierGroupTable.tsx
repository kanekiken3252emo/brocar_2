"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ShoppingCart,
  MapPin,
  Clock,
} from "lucide-react";
import type { SupplierGroup } from "@/lib/suppliers/adapter";
import { getVegaName } from "@/lib/vega-names";
import { formatDeliveryDays } from "@/lib/utils";
import ProductImage from "@/components/Items/ProductImage";
import { addOfferToCart } from "@/components/Items/SupplierGroupListItem";

export type TableSortKey = "price-asc" | "price-desc" | "name" | "delivery";

function fmtPrice(n: number | null | undefined) {
  return Number.isFinite(n) ? (n as number).toLocaleString("ru-RU") : "—";
}

function StockDot({ stock }: { stock: number }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${
        stock > 5 ? "bg-green-500" : stock > 0 ? "bg-yellow-500" : "bg-neutral-600"
      }`}
    />
  );
}

/**
 * Плотный табличный вид выдачи каталога (по образцу Армтека, в нашей теме):
 * строка = товар, раскрывается в предложения по складам с корзиной. Заголовки
 * «Наименование», «Срок», «Цена» кликабельны — переключают сортировку.
 */
export default function SupplierGroupTable({
  groups,
  sortBy,
  onSortChange,
}: {
  groups: SupplierGroup[];
  sortBy: TableSortKey;
  onSortChange: (s: TableSortKey) => void;
}) {
  // Раскрытые товары (ключ — артикул+бренд). Первая строка предложений видна
  // всегда, раскрытие показывает остальные.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const keyOf = (g: SupplierGroup) => `${g.article}|${g.brand}`;
  const toggle = (k: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const sortIcon = (active: boolean, dir?: "asc" | "desc") =>
    active ? (
      dir === "desc" ? (
        <ChevronDown className="h-3.5 w-3.5 text-orange-400" />
      ) : (
        <ChevronUp className="h-3.5 w-3.5 text-orange-400" />
      )
    ) : (
      <ChevronsUpDown className="h-3.5 w-3.5 text-neutral-600" />
    );

  const th =
    "px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-400 whitespace-nowrap";
  const thBtn =
    "inline-flex items-center gap-1 hover:text-orange-400 transition-colors";

  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-neutral-900">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="bg-neutral-800/50">
          <tr className="border-b border-neutral-800">
            <th className={th}>Фото</th>
            <th className={th}>Бренд / Артикул</th>
            <th className={th}>
              <button
                type="button"
                className={thBtn}
                onClick={() => onSortChange("name")}
              >
                Наименование {sortIcon(sortBy === "name")}
              </button>
            </th>
            <th className={`${th} text-right`}>Наличие</th>
            <th className={th}>Склад</th>
            <th className={th}>
              <button
                type="button"
                className={thBtn}
                onClick={() => onSortChange("delivery")}
              >
                Поставка {sortIcon(sortBy === "delivery")}
              </button>
            </th>
            <th className={`${th} text-right`}>
              <button
                type="button"
                className={thBtn}
                onClick={() =>
                  onSortChange(
                    sortBy === "price-asc" ? "price-desc" : "price-asc"
                  )
                }
              >
                Цена{" "}
                {sortIcon(
                  sortBy === "price-asc" || sortBy === "price-desc",
                  sortBy === "price-desc" ? "desc" : "asc"
                )}
              </button>
            </th>
            <th className="w-12" />
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800">
          {groups.map((g) => {
            const k = keyOf(g);
            const open = expanded.has(k);
            const offers = open ? g.offers : g.offers.slice(0, 1);
            const more = g.offers.length - 1;
            const href = `/product/${encodeURIComponent(
              g.article
            )}?brand=${encodeURIComponent(g.brand)}`;
            return (
              <Fragment key={k}>
                {offers.map((offer, oi) => (
                  <tr
                    key={`${offer.supplierCode}-${oi}`}
                    className="transition-colors hover:bg-neutral-800/40"
                  >
                    {oi === 0 ? (
                      <>
                        <td className="px-3 py-2" rowSpan={offers.length}>
                          <Link href={href} className="block">
                            <ProductImage
                              brand={g.brand}
                              article={g.article}
                              alt={g.name || "Товар"}
                              className="h-12 w-12 rounded-lg"
                              innerPadding="p-1"
                              sizes="48px"
                            />
                          </Link>
                        </td>
                        <td className="px-3 py-2" rowSpan={offers.length}>
                          <p className="text-xs font-bold uppercase tracking-wide text-orange-500">
                            {g.brand || "—"}
                          </p>
                          <p className="font-mono text-sm font-bold text-white">
                            {g.article}
                          </p>
                        </td>
                        <td
                          className="max-w-[360px] px-3 py-2"
                          rowSpan={offers.length}
                        >
                          <Link
                            href={href}
                            className="line-clamp-2 break-words text-neutral-100 transition-colors hover:text-orange-400"
                          >
                            {g.name}
                          </Link>
                        </td>
                      </>
                    ) : null}
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <span className="inline-flex items-center gap-1.5 font-medium text-white">
                        <StockDot stock={offer.stock} />
                        {offer.stock} шт.
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-neutral-300">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-neutral-500" />
                        {getVegaName(offer.supplierCode)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-neutral-300">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-neutral-500" />
                        {formatDeliveryDays(offer.deliveryDays)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-white">
                      {fmtPrice(offer.ourPrice)}{" "}
                      <span className="text-neutral-500">₽</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={(e) => addOfferToCart(e, offer, g)}
                        className="rounded-lg bg-orange-500 p-2 text-white shadow-md shadow-orange-500/20 transition-colors hover:bg-orange-600"
                        title="Добавить в корзину"
                      >
                        <ShoppingCart className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {more > 0 && (
                  <tr>
                    <td colSpan={8} className="p-0">
                      <button
                        type="button"
                        onClick={() => toggle(k)}
                        className="flex w-full items-center justify-center gap-1.5 bg-neutral-800/30 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:bg-neutral-800/60 hover:text-orange-400"
                      >
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform ${
                            open ? "rotate-180" : ""
                          }`}
                        />
                        {open
                          ? "Свернуть предложения"
                          : `Ещё ${more} предложен${
                              more === 1 ? "ие" : more < 5 ? "ия" : "ий"
                            }`}
                      </button>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
