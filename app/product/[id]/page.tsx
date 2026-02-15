"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import NextImage from "next/image";
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
  Shield,
  Truck,
} from "lucide-react";
import { bergClient } from "@/lib/bergClient";
import ItemCard from "@/components/Items/ItemCard";
import { Button } from "@/components/ui/button";
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
    console.log("Add to cart:", { product, offer: selectedOffer });
    alert("Функция добавления в корзину в разработке");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950">
        <Loader2 className="w-12 h-12 animate-spin text-orange-500 mb-4" />
        <span className="text-lg text-neutral-400">Загрузка товара...</span>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <div className="bg-neutral-900 border border-red-500/30 rounded-2xl p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Ошибка</h2>
          <p className="text-neutral-400 mb-6">{error || "Товар не найден"}</p>
          <Link href="/">
            <Button>Вернуться на главную</Button>
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
    <div className="min-h-screen bg-neutral-950">
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumbs */}
        <div className="mb-6">
          <Link href="/catalog" className="inline-flex items-center text-orange-500 hover:text-orange-400 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Вернуться в каталог
          </Link>
        </div>

        {/* Product Details */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden mb-8">
          <div className="grid md:grid-cols-2 gap-8 p-8">
            {/* Image Section */}
            <div className="space-y-4">
              <div className="aspect-square bg-neutral-800 rounded-2xl flex items-center justify-center p-8">
                <NextImage
                  src="/photo-soon.png"
                  alt="Фото товара"
                  width={300}
                  height={300}
                  className="w-full h-full object-contain"
                />
              </div>
              
              {/* Stock Status */}
              <div className="flex items-center gap-4">
                {totalStock > 0 ? (
                  <div className="flex items-center gap-2 text-green-400 bg-green-500/10 border border-green-500/30 px-4 py-2 rounded-xl">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-semibold">В наличии: {totalStock} шт.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-neutral-400 bg-neutral-800 border border-neutral-700 px-4 py-2 rounded-xl">
                    <Clock className="w-5 h-5" />
                    <span className="font-semibold">Под заказ</span>
                  </div>
                )}
              </div>

              {/* Features */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3 bg-neutral-800/50 border border-neutral-700/50 rounded-xl p-3">
                  <Shield className="w-5 h-5 text-orange-500" />
                  <span className="text-sm text-neutral-400">Гарантия</span>
                </div>
                <div className="flex items-center gap-3 bg-neutral-800/50 border border-neutral-700/50 rounded-xl p-3">
                  <Truck className="w-5 h-5 text-orange-500" />
                  <span className="text-sm text-neutral-400">Доставка</span>
                </div>
              </div>
            </div>

            {/* Info Section */}
            <div className="space-y-6">
              {/* Brand */}
              <div className="inline-block px-3 py-1 bg-orange-500/20 border border-orange-500/30 rounded-lg">
                <span className="text-sm text-orange-400 font-semibold">
                  {product.brand?.name || "Неизвестный бренд"}
                </span>
              </div>

              {/* Name */}
              <h1 className="text-3xl font-bold text-white">{product.name}</h1>

              {/* Article */}
              <div className="flex items-center gap-2">
                <span className="text-neutral-500">Артикул:</span>
                <span className="font-mono font-bold text-lg text-white bg-neutral-800 px-3 py-1 rounded-lg">
                  {product.article}
                </span>
              </div>

              {/* Price */}
              {minPrice && (
                <div className="bg-gradient-to-r from-orange-500/20 to-orange-600/10 border border-orange-500/30 rounded-2xl p-6">
                  <div className="text-sm text-neutral-400 mb-1">Цена от</div>
                  <div className="text-4xl font-bold text-white">
                    {minPrice.toLocaleString("ru-RU")} <span className="text-xl text-neutral-400">₽</span>
                  </div>
                </div>
              )}

              {/* Add to Cart */}
              <Button
                onClick={handleAddToCart}
                disabled={!selectedOffer || totalStock === 0}
                size="xl"
                className="w-full"
              >
                <ShoppingCart className="w-5 h-5" />
                Добавить в корзину
              </Button>

              {/* Description */}
              <div className="border-t border-neutral-800 pt-6">
                <h3 className="font-semibold text-white mb-2">Описание</h3>
                <p className="text-neutral-400">{product.name}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Offers Table */}
        {product.offers && product.offers.length > 0 && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-neutral-800">
              <h2 className="text-xl font-bold text-white">Предложения поставщиков</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-800/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                      Склад
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                      Количество
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                      Цена
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                      Срок
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                      Надежность
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                      Действие
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {product.offers.map((offer, index) => (
                    <tr
                      key={index}
                      className={`hover:bg-neutral-800/50 transition-colors ${
                        selectedOffer === offer ? "bg-orange-500/10" : ""
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-neutral-500" />
                          <span className="text-sm text-neutral-300">{offer.warehouse.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-300">
                        {offer.quantity} шт.
                        {offer.available_more && (
                          <span className="text-green-400 ml-1">+</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-white">
                        {offer.price.toLocaleString("ru-RU")} ₽
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-300">
                        {offer.average_period} дн.
                        {offer.is_transit && (
                          <span className="ml-2 text-xs text-orange-400">(в пути)</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-neutral-700 rounded-full overflow-hidden w-20">
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
                          <span className="text-xs text-neutral-400">{offer.reliability}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setSelectedOffer(offer)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            selectedOffer === offer
                              ? "bg-orange-500 text-white"
                              : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700 border border-neutral-700"
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
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-white mb-6">Аналоги</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
