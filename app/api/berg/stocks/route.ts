import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const BERG_API_URL = process.env.BERG_API_URL || "https://api.berg.ru";
const BERG_API_KEY = process.env.BERG_API_KEY_1;

export async function POST(request: NextRequest) {
  try {
    if (!BERG_API_KEY) {
      return NextResponse.json(
        { error: "BERG API key not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { resourceIds } = body;

    if (!resourceIds || !Array.isArray(resourceIds) || resourceIds.length === 0) {
      return NextResponse.json(
        { error: "resourceIds array is required" },
        { status: 400 }
      );
    }

    // Get stock from get_stock endpoint
    const url = `${BERG_API_URL}/v1.0/ordering/get_stock.json?key=${BERG_API_KEY}`;

    const params: Record<string, any> = {
      analogs: 0,
    };

    resourceIds.forEach((id: number, index: number) => {
      params[`items[${index}][resource_id]`] = id;
    });

    console.log("BERG Stocks Request:", { resourceIds });

    const response = await axios.get(url, {
      params,
      timeout: 30000,
      headers: {
        "User-Agent": "BroCar/1.0",
      },
    });

    // Extract stock info from offers
    const stocks = response.data.resources?.map((resource: any) => ({
      resourceId: resource.id,
      article: resource.article,
      brand: resource.brand?.name,
      totalQuantity: resource.offers?.reduce(
        (sum: number, offer: any) => sum + offer.quantity,
        0
      ) || 0,
      warehouses: resource.offers?.map((offer: any) => ({
        warehouseId: offer.warehouse.id,
        warehouseName: offer.warehouse.name,
        warehouseType: offer.warehouse.type,
        quantity: offer.quantity,
        availableMore: offer.available_more,
        reliability: offer.reliability,
        averagePeriod: offer.average_period,
        assuredPeriod: offer.assured_period,
        isTransit: offer.is_transit,
      })) || [],
    })) || [];

    return NextResponse.json({ stocks });
  } catch (error: any) {
    console.error("BERG Stocks Error:", {
      message: error.message,
      response: error.response?.data,
    });

    if (axios.isAxiosError(error)) {
      return NextResponse.json(
        {
          error: "BERG API stocks request failed",
          details: error.response?.data || error.message,
        },
        { status: error.response?.status || 500 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

