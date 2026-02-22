"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { ShoppingCart, Check, AlertCircle } from "lucide-react";

interface ProductData {
  article: string;
  brand: string;
  name: string;
  price: number;
}

export interface AddToCartButtonProps {
  /** Database ID of the product */
  productId?: number;
  /** Product data from search results */
  product?: ProductData;
  disabled?: boolean;
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

type State = "idle" | "loading" | "success" | "error";

export function AddToCartButton({
  productId,
  product,
  disabled,
  size = "default",
  className = "",
}: AddToCartButtonProps) {
  const [state, setState] = useState<State>("idle");

  const handleAddToCart = async () => {
    if (state === "loading" || state === "success") return;
    setState("loading");

    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          productId
            ? { action: "add", productId, qty: 1 }
            : { action: "add", product, qty: 1 }
        ),
      });

      if (!res.ok) throw new Error("cart error");

      setState("success");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2500);
    }
  };

  const label = {
    idle: "В корзину",
    loading: "Добавляем...",
    success: "Добавлено!",
    error: "Ошибка",
  }[state];

  const icon = {
    idle: <ShoppingCart className="h-4 w-4" />,
    loading: <ShoppingCart className="h-4 w-4 animate-pulse" />,
    success: <Check className="h-4 w-4" />,
    error: <AlertCircle className="h-4 w-4" />,
  }[state];

  return (
    <Button
      onClick={handleAddToCart}
      disabled={disabled || state === "loading"}
      size={size}
      className={[
        state === "success" && "bg-green-600 hover:bg-green-600",
        state === "error" && "bg-red-600 hover:bg-red-600",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon}
      <span className="ml-2">{label}</span>
    </Button>
  );
}
