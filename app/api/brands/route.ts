import { NextResponse } from "next/server";
import axios from "axios";

/**
 * Get all available brands from Berg.ru
 * Endpoint: /references/brands
 */
export async function GET() {
  const apiKey = process.env.BERG_API_KEY_1;
  const baseUrl = process.env.BERG_API_URL || "https://api.berg.ru";

  if (!apiKey) {
    return NextResponse.json(
      { error: "Berg.ru API key not configured" },
      { status: 500 }
    );
  }

  try {
    const response = await axios.get(
      `${baseUrl}/v1.0/references/brands.json`,
      {
        params: {
          key: apiKey,
        },
        timeout: 10000,
      }
    );

    // Berg.ru returns { brands: [{ id: number, name: string }] }
    const brands = response.data.brands || [];

    return NextResponse.json({
      brands: brands,
      count: brands.length,
    });
  } catch (error) {
    console.error("Berg.ru brands API error:", error);

    if (axios.isAxiosError(error)) {
      return NextResponse.json(
        {
          error: "Failed to fetch brands from Berg.ru",
          details: error.message,
        },
        { status: error.response?.status || 500 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

