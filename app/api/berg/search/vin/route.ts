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
    const { vin } = body;

    if (!vin || typeof vin !== "string") {
      return NextResponse.json(
        { error: "VIN is required and must be a string" },
        { status: 400 }
      );
    }

    // Validate VIN format (17 characters)
    if (vin.length !== 17) {
      return NextResponse.json(
        { error: "VIN must be exactly 17 characters" },
        { status: 400 }
      );
    }

    console.log("BERG VIN Search:", vin);

    // BERG API doesn't have a direct VIN endpoint in the documentation
    // We'll use the article search endpoint with VIN as article
    // This is a workaround - adjust based on actual BERG API VIN support
    const url = `${BERG_API_URL}/v1.0/ordering/get_stock.json?key=${BERG_API_KEY}`;

    const params = {
      "items[0][resource_article]": vin,
      analogs: 1, // Get analogs for VIN search
    };

    const response = await axios.get(url, {
      params,
      timeout: 30000,
      headers: {
        "User-Agent": "BroCar/1.0",
      },
    });

    console.log("BERG VIN Response:", {
      status: response.status,
      resourcesCount: response.data.resources?.length || 0,
    });

    return NextResponse.json({
      vin,
      ...response.data,
    });
  } catch (error: any) {
    console.error("BERG VIN Search Error:", {
      message: error.message,
      response: error.response?.data,
    });

    if (axios.isAxiosError(error)) {
      return NextResponse.json(
        {
          error: "BERG API VIN search failed",
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

