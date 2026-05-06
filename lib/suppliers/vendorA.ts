import axios from "axios";
import type { SupplierAdapter, SearchParams, SupplierItem } from "./adapter";

/**
 * Vendor A API adapter
 * Implements integration with external auto parts supplier
 */
export class VendorAAdapter implements SupplierAdapter {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.VENDOR_A_URL || "";
    this.apiKey = process.env.VENDOR_A_KEY || "";
  }

  async search(params: SearchParams): Promise<SupplierItem[]> {
    if (!this.baseUrl || !this.apiKey) {
      console.warn("Vendor A credentials not configured");
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
      // NOTE: Adjust field mapping based on actual vendor API response structure
      const items = response.data.items || response.data.results || [];

      return items.map((item: any) => ({
        article: item.article || item.partNumber || "",
        brand: item.brand || item.manufacturer || "",
        name: item.name || item.description || "",
        price: parseFloat(item.price || item.cost || 0),
        stock: parseInt(item.stock || item.quantity || 0, 10),
        supplier: "Vendor A",
        raw: item,
      }));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Vendor A API error:", error.message);
      } else {
        console.error("Vendor A unexpected error:", error);
      }
      return [];
    }
  }
}

/**
 * Mock implementation for development/testing
 */
export class VendorAMockAdapter implements SupplierAdapter {
  async search(params: SearchParams): Promise<SupplierItem[]> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Return mock data for testing
    if (!params.article && !params.brand) {
      return [];
    }

    return [
      {
        article: params.article || "12345",
        brand: params.brand || "Bosch",
        name: "Тормозные колодки передние",
        price: 2500,
        stock: 15,
        supplier: "Vendor A (Mock)",
      },
      {
        article: params.article || "12345",
        brand: params.brand || "ATE",
        name: "Тормозные колодки передние альтернатива",
        price: 2200,
        stock: 8,
        supplier: "Vendor A (Mock)",
      },
    ];
  }
}

// Export appropriate adapter based on environment
const vendorAAdapter =
  process.env.NODE_ENV === "production"
    ? new VendorAAdapter()
    : new VendorAMockAdapter();

export default vendorAAdapter;




