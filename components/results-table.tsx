"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Badge } from "./ui/badge";
import { formatPrice } from "@/lib/utils";
import { AddToCartButton } from "./add-to-cart-button";

interface ResultItem {
  article: string;
  brand: string;
  name: string;
  supplier: string;
  stock: number;
  supplierPrice: number;
  ourPrice: number;
}

interface ResultsTableProps {
  results: ResultItem[];
}

export function ResultsTable({ results }: ResultsTableProps) {
  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>Результаты не найдены</p>
        <p className="text-sm mt-2">
          Попробуйте изменить параметры поиска
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Артикул</TableHead>
            <TableHead>Бренд</TableHead>
            <TableHead>Наименование</TableHead>
            <TableHead>Поставщик</TableHead>
            <TableHead>Наличие</TableHead>
            <TableHead>Цена закупки</TableHead>
            <TableHead>Наша цена</TableHead>
            <TableHead className="text-right">Действие</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((item, index) => (
            <TableRow key={`${item.article}-${item.supplier}-${index}`}>
              <TableCell className="font-medium">{item.article}</TableCell>
              <TableCell>{item.brand}</TableCell>
              <TableCell className="max-w-xs">{item.name}</TableCell>
              <TableCell>
                <Badge variant="outline">{item.supplier}</Badge>
              </TableCell>
              <TableCell>
                {item.stock > 0 ? (
                  <Badge variant="success">{item.stock} шт.</Badge>
                ) : (
                  <Badge variant="destructive">Нет в наличии</Badge>
                )}
              </TableCell>
              <TableCell className="text-gray-600">
                {formatPrice(item.supplierPrice)}
              </TableCell>
              <TableCell className="font-semibold">
                {formatPrice(item.ourPrice)}
              </TableCell>
              <TableCell className="text-right">
                <AddToCartButton
                  product={{
                    article: item.article,
                    brand: item.brand,
                    name: item.name,
                    price: item.ourPrice,
                  }}
                  disabled={item.stock === 0}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}




