export interface AddSupplierItemParams {
  article: string;
  brand: string;
  name: string;
  ourPrice: number;
  supplierPrice: number;
  stock: number;
  qty?: number;
}

export async function addSupplierItemToCart(
  params: AddSupplierItemParams
): Promise<void> {
  const res = await fetch("/api/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "addFromSupplier",
      article: params.article,
      brand: params.brand || "",
      name: params.name,
      ourPrice: params.ourPrice,
      supplierPrice: params.supplierPrice,
      stock: params.stock,
      qty: params.qty ?? 1,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Не удалось добавить в корзину");
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("cart:added", {
        detail: {
          article: params.article,
          brand: params.brand,
          name: params.name,
          qty: params.qty ?? 1,
        },
      })
    );
  }
}
