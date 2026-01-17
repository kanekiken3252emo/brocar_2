import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const BERG_API_URL = process.env.BERG_API_URL || "https://api.berg.ru";
const BERG_API_KEY = process.env.BERG_API_KEY_1;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!BERG_API_KEY) {
      return NextResponse.json(
        { error: "BERG API key not configured" },
        { status: 500 }
      );
    }

    const { id } = await params;
    const resourceId = id;

    if (!resourceId) {
      return NextResponse.json(
        { error: "Resource ID is required" },
        { status: 400 }
      );
    }

    // Get article details from get_stock endpoint
    const url = `${BERG_API_URL}/v1.0/ordering/get_stock.json?key=${BERG_API_KEY}`;

    const searchParams = {
      "items[0][resource_id]": resourceId,
      analogs: 1, // Include analogs
    };

    console.log("BERG Article Request:", { resourceId });

    const response = await axios.get(url, {
      params: searchParams,
      timeout: 30000,
      headers: {
        "User-Agent": "BroCar/1.0",
      },
    });

    if (!response.data.resources || response.data.resources.length === 0) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    const article = response.data.resources[0];

    return NextResponse.json({
      article,
      analogs: response.data.resources.slice(1), // Other resources are analogs
    });
  } catch (error: any) {
    console.error("BERG Article Error:", {
      message: error.message,
      response: error.response?.data,
    });

    if (axios.isAxiosError(error)) {
      return NextResponse.json(
        {
          error: "BERG API article request failed",
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

