import axios from "axios";
import type { SupplierAdapter, SearchParams, SupplierItem } from "./adapter";

/**
 * Berg.ru API adapter
 * Documentation: https://api.berg.ru
 * 
 * Rate limits:
 * - 300 requests per minute
 * - 100,000 requests per day
 */
export class BergAdapter implements SupplierAdapter {
  private baseUrl: string;
  private apiKey1: string;
  private apiKey2: string;
  private apiKey3: string;

  constructor() {
    this.baseUrl = process.env.BERG_API_URL || "https://api.berg.ru";
    this.apiKey1 = process.env.BERG_API_KEY_1 || "";
    this.apiKey2 = process.env.BERG_API_KEY_2 || "";
    this.apiKey3 = process.env.BERG_API_KEY_3 || "";
  }

  async search(params: SearchParams): Promise<SupplierItem[]> {
    if (!this.apiKey1) {
      console.warn("Berg.ru API key not configured");
      return [];
    }

    // Berg.ru requires article (brand is optional)
    if (!params.article) {
      console.warn("Berg.ru API: article is required, skipping search");
      return [];
    }

    try {
      // Berg.ru API: GET /v1.0/ordering/get_stock
      // Documentation: https://api.berg.ru
      // Berg.ru requires specific URL format without encoding
      
      // Build URL manually without encoding brackets
      let url = `${this.baseUrl}/v1.0/ordering/get_stock.json?key=${this.apiKey1}&analogs=0`;

      if (params.article) {
        url += `&items[0][resource_article]=${encodeURIComponent(params.article)}`;
      }
      
      if (params.brand) {
        url += `&items[0][brand_name]=${encodeURIComponent(params.brand)}`;
      }

      console.log('Berg.ru API request URL:', url);

      const response = await axios.get(url, {
        timeout: 8000,
      });

      // Berg.ru returns { resources: [...], warnings: [...] }
      const resources = response.data.resources || [];
      const allItems: SupplierItem[] = [];

      // Each resource can have multiple offers (from different warehouses)
      for (const resource of resources) {
        const offers = resource.offers || [];
        
        // Process each offer
        for (const offer of offers) {
          // Only include items with stock and reasonable reliability
          if (offer.quantity > 0 && offer.reliability >= 80) {
            allItems.push({
              article: resource.article || "",
              brand: resource.brand?.name || "",
              name: resource.name || "",
              price: parseFloat(offer.price || 0),
              stock: parseInt(offer.quantity || 0, 10),
              supplier: `Berg.ru (${offer.warehouse?.name || "склад"})`,
              raw: {
                resource_id: resource.id,
                warehouse_id: offer.warehouse?.id,
                warehouse_type: offer.warehouse?.type,
                reliability: offer.reliability,
                average_period: offer.average_period,
                assured_period: offer.assured_period,
                multiplication_factor: offer.multiplication_factor,
                delivery_type: offer.delivery_type,
                is_transit: offer.is_transit,
                available_more: offer.available_more,
              },
            });
          }
        }
      }

      return allItems;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Handle rate limiting (429 Too Many Requests)
        if (error.response?.status === 429) {
          console.error("Berg.ru API: Rate limit exceeded (300/min or 100k/day)");
        } else if (error.response?.status === 300) {
          // 300 Multiple Choices - article is ambiguous
          console.warn("Berg.ru API: Article is ambiguous, need to specify brand");
        } else {
          console.error("Berg.ru API error:", {
            status: error.response?.status,
            message: error.message,
            data: error.response?.data,
            url: error.config?.url,
            params: error.config?.params,
          });
          // Log full error details
          console.error("Full error details:", JSON.stringify(error.response?.data, null, 2));
        }
      } else {
        console.error("Berg.ru unexpected error:", error);
      }
      return [];
    }
  }
}

// Export real Berg.ru adapter only
const bergAdapter = new BergAdapter();

export default bergAdapter;

