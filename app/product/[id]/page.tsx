"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Package,
  Clock,
  MapPin,
  TrendingUp,
  ShoppingCart,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { bergClient } from "@/lib/bergClient";
import ItemCard from "@/components/Items/ItemCard";
import type { BergResource, BergOffer } from "@/types/berg-api";

export default function ProductPage() {
  const params = useParams();
  const productId = params?.id as string;

  const [product, setProduct] = useState<BergResource | null>(null);
  const [analogs, setAnalogs] = useState<BergResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<BergOffer | null>(null);

  useEffect(() => {
    if (productId) {
      loadProduct();
    }
  }, [productId]);

  const loadProduct = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await bergClient.getArticle(productId);
      setProduct(response.article);
      setAnalogs(response.analogs || []);
      
      // Select best offer by default
      if (response.article.offers && response.article.offers.length > 0) {
        const bestOffer = response.article.offers.reduce((best, current) => {
          if (!best) return current;
          if (current.price < best.price && current.reliability >= 80) {
            return current;
          }
          return best;
        });
        setSelectedOffer(bestOffer);
      }
    } catch (err: any) {
      console.error("Product load error:", err);
      setError(err.message || "Не удалось загрузить товар");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (!product || !selectedOffer) return;
    // TODO: Implement add to cart
    console.log("Add to cart:", { product, offer: selectedOffer });
    alert("Функция добавления в корзину в разработке");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        <span className="ml-3 text-lg text-gray-600">Загрузка товара...</span>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-700 mb-2">Ошибка</h2>
          <p className="text-red-600 mb-6">{error || "Товар не найден"}</p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Вернуться на главную
          </Link>
        </div>
      </div>
    );
  }

  const totalStock = product.offers?.reduce((sum, offer) => sum + offer.quantity, 0) || 0;
  const minPrice = product.offers?.length
    ? Math.min(...product.offers.map((o) => o.price))
    : null;

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumbs */}
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-blue-600 hover:text-blue-700">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Вернуться в каталог
          </Link>
        </div>

        {/* Product Details */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="grid md:grid-cols-2 gap-8 p-8">
            {/* Image Section */}
            <div className="space-y-4">
              <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                <Package className="w-32 h-32 text-gray-400" />
              </div>
              
              {/* Stock Status */}
              <div className="flex items-center gap-4">
                {totalStock > 0 ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-semibold">В наличии: {totalStock} шт.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Clock className="w-5 h-5" />
                    <span className="font-semibold">Под заказ</span>
                  </div>
                )}
              </div>
            </div>

            {/* Info Section */}
            <div className="space-y-6">
              {/* Brand */}
              <div>
                <span className="text-sm text-blue-600 font-semibold">
                  {product.brand?.name || "Неизвестный бренд"}
                </span>
              </div>

              {/* Name */}
              <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>

              {/* Article */}
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Артикул:</span>
                <span className="font-mono font-bold text-lg">{product.article}</span>
              </div>

              {/* Price */}
              {minPrice && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <div className="text-sm text-gray-600 mb-1">Цена от</div>
                  <div className="text-4xl font-bold text-blue-600">
                    {minPrice.toLocaleString("ru-RU")} ₽
                  </div>
                </div>
              )}

              {/* Add to Cart */}
              <button
                onClick={handleAddToCart}
                disabled={!selectedOffer || totalStock === 0}
                className="w-full py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-5 h-5" />
                Добавить в корзину
              </button>

              {/* Description */}
              <div className="border-t pt-6">
                <h3 className="font-semibold text-gray-900 mb-2">Описание</h3>
                <p className="text-gray-600">{product.name}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Offers Table */}
        {product.offers && product.offers.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-8 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Предложения поставщиков</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Склад
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Количество
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Цена
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Срок
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Надежность
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Действие
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {product.offers.map((offer, index) => (
                    <tr
                      key={index}
                      className={`hover:bg-gray-50 ${
                        selectedOffer === offer ? "bg-blue-50" : ""
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">{offer.warehouse.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {offer.quantity} шт.
                        {offer.available_more && (
                          <span className="text-green-600 ml-1">+</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold">
                        {offer.price.toLocaleString("ru-RU")} ₽
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {offer.average_period} дн.
                        {offer.is_transit && (
                          <span className="ml-2 text-xs text-orange-600">(в пути)</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden w-20">
                            <div
                              className={`h-full ${
                                offer.reliability >= 90
                                  ? "bg-green-500"
                                  : offer.reliability >= 70
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                              }`}
                              style={{ width: `${offer.reliability}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600">{offer.reliability}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setSelectedOffer(offer)}
                          className={`px-4 py-2 rounded text-sm font-medium ${
                            selectedOffer === offer
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          {selectedOffer === offer ? "Выбрано" : "Выбрать"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Analogs */}
        {analogs.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Аналоги</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {analogs.slice(0, 8).map((analog) => (
                <ItemCard key={analog.id} resource={analog} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
