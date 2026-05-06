import type {
  BergSearchParams,
  BergStockResponse,
  BergResource,
} from "@/types/berg-api";

/**
 * BERG API Client
 * All requests go through /api/berg/* to keep API keys secure
 */

export class BergClient {
  private baseUrl = "/api/berg";

  /**
   * Search by article number
   */
  async searchByArticle(
    article: string,
    options?: {
      brandName?: string;
      brandId?: number;
      analogs?: boolean;
    }
  ): Promise<BergStockResponse> {
    const searchParams: BergSearchParams = {
      items: [
        {
          resource_article: article,
          ...(options?.brandName && { brand_name: options.brandName }),
          ...(options?.brandId && { brand_id: options.brandId }),
        },
      ],
      analogs: options?.analogs ? 1 : 0,
    };

    const response = await fetch(`${this.baseUrl}/search/articles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(searchParams),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to search by article");
    }

    return response.json();
  }

  /**
   * Search by multiple articles
   */
  async searchByArticles(
    articles: Array<{
      article: string;
      brandName?: string;
      brandId?: number;
    }>,
    analogs: boolean = false
  ): Promise<BergStockResponse> {
    const searchParams: BergSearchParams = {
      items: articles.map((item) => ({
        resource_article: item.article,
        ...(item.brandName && { brand_name: item.brandName }),
        ...(item.brandId && { brand_id: item.brandId }),
      })),
      analogs: analogs ? 1 : 0,
    };

    const response = await fetch(`${this.baseUrl}/search/articles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(searchParams),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to search by articles");
    }

    return response.json();
  }

  /**
   * Search by resource ID
   */
  async searchByResourceId(
    resourceId: number,
    analogs: boolean = false
  ): Promise<BergStockResponse> {
    const searchParams: BergSearchParams = {
      items: [{ resource_id: resourceId }],
      analogs: analogs ? 1 : 0,
    };

    const response = await fetch(`${this.baseUrl}/search/articles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(searchParams),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to search by resource ID");
    }

    return response.json();
  }

  /**
   * Search by VIN
   */
  async searchByVIN(vin: string): Promise<BergStockResponse & { vin: string }> {
    const response = await fetch(`${this.baseUrl}/search/vin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ vin }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to search by VIN");
    }

    return response.json();
  }

  /**
   * Get vehicles (brands)
   */
  async searchVehicles(): Promise<{ brands: Array<{ id: number; name: string }> }> {
    const response = await fetch(`${this.baseUrl}/search/vehicles`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get vehicles");
    }

    return response.json();
  }

  /**
   * Get applicability for an article
   */
  async getApplicability(
    articleId: string
  ): Promise<{ applicability: any[]; message?: string }> {
    const response = await fetch(`${this.baseUrl}/search/applicability`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ articleId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get applicability");
    }

    return response.json();
  }

  /**
   * Get prices for resources
   */
  async getPrices(resourceIds: number[]): Promise<{
    prices: Array<{
      resourceId: number;
      article: string;
      brand: string;
      minPrice: number | null;
      maxPrice: number | null;
      offers: any[];
    }>;
  }> {
    const response = await fetch(`${this.baseUrl}/prices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ resourceIds }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get prices");
    }

    return response.json();
  }

  /**
   * Get stock information for resources
   */
  async getStocks(resourceIds: number[]): Promise<{
    stocks: Array<{
      resourceId: number;
      article: string;
      brand: string;
      totalQuantity: number;
      warehouses: Array<{
        warehouseId: number;
        warehouseName: string;
        warehouseType: number;
        quantity: number;
        availableMore: boolean;
        reliability: number;
        averagePeriod: number;
        assuredPeriod: number;
        isTransit: boolean;
      }>;
    }>;
  }> {
    const response = await fetch(`${this.baseUrl}/stocks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ resourceIds }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get stocks");
    }

    return response.json();
  }

  /**
   * Get article details by ID
   */
  async getArticle(id: string): Promise<{
    article: BergResource;
    analogs: BergResource[];
  }> {
    const response = await fetch(`${this.baseUrl}/article/${id}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get article");
    }

    return response.json();
  }
}

// Export singleton instance
export const bergClient = new BergClient();

