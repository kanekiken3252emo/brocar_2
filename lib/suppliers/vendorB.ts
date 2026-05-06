import axios from "axios";
import type { SupplierAdapter, SearchParams, SupplierItem } from "./adapter";

/**
 * Vendor B API adapter
 * Implements integration with second auto parts supplier
 */
export class VendorBAdapter implements SupplierAdapter {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.VENDOR_B_URL || "";
    this.apiKey = process.env.VENDOR_B_KEY || "";
  }

  async search(params: SearchParams): Promise<SupplierItem[]> {
    if (!this.baseUrl || !this.apiKey) {
      console.warn("Vendor B credentials not configured");
      return [];
    }

    try {
      // Call vendor API
      const response = await axios.post(
        `${this.baseUrl}/search`,
        {
          article: params.article,
          brand: params.brand,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 8000,
        }
      );

      // Map vendor response to our SupplierItem interface
      const items = response.data.items || response.data.results || [];

      return items.map((item: any) => ({
        article: item.article || item.code || "",
        brand: item.brand || item.make || "",
        name: item.name || item.title || "",
        price: parseFloat(item.price || item.amount || 0),
        stock: parseInt(item.stock || item.available || 0, 10),
        supplier: "Vendor B",
        raw: item,
      }));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Vendor B API error:", error.message);
      } else {
        console.error("Vendor B unexpected error:", error);
      }
      return [];
    }
  }
}

/**
 * Mock implementation for development/testing
 */
export class VendorBMockAdapter implements SupplierAdapter {
  async search(params: SearchParams): Promise<SupplierItem[]> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Return mock data for testing
    if (!params.article && !params.brand) {
      return [];
    }

    return [
      {
        article: params.article || "12345",
        brand: params.brand || "Brembo",
        name: "Тормозные колодки передние премиум",
        price: 3200,
        stock: 5,
        supplier: "Vendor B (Mock)",
      },
      {
        article: params.article || "54321",
        brand: params.brand || "Bosch",
        name: "Фильтр масляный",
        price: 450,
        stock: 25,
        supplier: "Vendor B (Mock)",
      },
    ];
  }
}

// Export appropriate adapter based on environment
const vendorBAdapter =
  process.env.NODE_ENV === "production"
    ? new VendorBAdapter()
    : new VendorBMockAdapter();

export default vendorBAdapter;




