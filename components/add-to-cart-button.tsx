"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { ShoppingCart } from "lucide-react";

interface AddToCartButtonProps {
  product: {
    article: string;
    brand: string;
    name: string;
    price: number;
  };
  disabled?: boolean;
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function AddToCartButton({ 
  product, 
  disabled, 
  size = "default",
  className = "" 
}: AddToCartButtonProps) {
  const [isAdding, setIsAdding] = useState(false);

  const handleAddToCart = async () => {
    setIsAdding(true);

    try {
      // TODO: In production, you'd need to save the product to DB first
      // and get its ID, then add to cart via /api/cart
      // For now, this is a placeholder
      
      console.log("Adding to cart:", product);
      
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Show success feedback
      alert(`✅ Добавлено в корзину:\n${product.name}\n${product.price.toLocaleString("ru-RU")} ₽`);
    } catch (error) {
      console.error("Error adding to cart:", error);
      alert("❌ Ошибка при добавлении в корзину");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Button
      onClick={handleAddToCart}
      disabled={disabled || isAdding}
      size={size}
      className={`bg-blue-600 hover:bg-blue-700 ${className}`}
    >
      <ShoppingCart className="mr-2 h-4 w-4" />
      {isAdding ? "Добавление..." : "В корзину"}
    </Button>
  );
}




