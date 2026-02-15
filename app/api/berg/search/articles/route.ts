import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import type { BergSearchParams, BergStockResponse } from "@/types/berg-api";

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

    const body: BergSearchParams = await request.json();

    // Validate request
    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: "Items array is required" },
        { status: 400 }
      );
    }

    // Build URL with key
    const url = `${BERG_API_URL}/v1.0/ordering/get_stock.json?key=${BERG_API_KEY}`;

    // Prepare params
    const params: Record<string, any> = {
      analogs: body.analogs || 0,
    };

    // Add items
    body.items.forEach((item, index) => {
      if (item.resource_id) {
        params[`items[${index}][resource_id]`] = item.resource_id;
      }
      if (item.resource_article) {
        params[`items[${index}][resource_article]`] = item.resource_article;
      }
      if (item.brand_id) {
        params[`items[${index}][brand_id]`] = item.brand_id;
      }
      if (item.brand_name) {
        params[`items[${index}][brand_name]`] = item.brand_name;
      }
    });

    // Add warehouse types
    if (body.warehouse_types) {
      body.warehouse_types.forEach((type, index) => {
        params[`warehouse_types[${index}]`] = type;
      });
    }

    // Add address_id
    if (body.address_id) {
      params.address_id = body.address_id;
    }

    console.log("BERG API Request:", url);
    console.log("BERG API Params:", params);

    // Make request to BERG API
    const response = await axios.get<BergStockResponse>(url, {
      params,
      timeout: 30000,
      headers: {
        "User-Agent": "BroCar/1.0",
      },
    });

    console.log("BERG API Response:", {
      status: response.status,
      resourcesCount: response.data.resources?.length || 0,
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error("BERG API Error:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });

    if (axios.isAxiosError(error)) {
      return NextResponse.json(
        {
          error: "BERG API request failed",
          details: error.response?.data || error.message,
          status: error.response?.status,
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

