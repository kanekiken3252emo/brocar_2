import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const BERG_API_URL = process.env.BERG_API_URL || "https://api.berg.ru";
const BERG_API_KEY = process.env.BERG_API_KEY_1;

export async function GET(request: NextRequest) {
  try {
    if (!BERG_API_KEY) {
      return NextResponse.json(
        { error: "BERG API key not configured" },
        { status: 500 }
      );
    }

    // Get brands from BERG API
    const url = `${BERG_API_URL}/v1.0/references/brands.json?key=${BERG_API_KEY}`;

    console.log("BERG Brands Request:", url);

    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        "User-Agent": "BroCar/1.0",
      },
    });

    console.log("BERG Brands Response:", {
      status: response.status,
      brandsCount: response.data.brands?.length || 0,
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error("BERG Brands Error:", {
      message: error.message,
      response: error.response?.data,
    });

    if (axios.isAxiosError(error)) {
      return NextResponse.json(
        {
          error: "BERG API brands request failed",
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

