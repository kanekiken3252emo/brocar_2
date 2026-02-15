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
    const { articleId, resourceId } = body;

    if (!articleId && !resourceId) {
      return NextResponse.json(
        { error: "articleId or resourceId is required" },
        { status: 400 }
      );
    }

    // Note: BERG API documentation doesn't show a specific applicability endpoint
    // This would need to be implemented based on actual BERG API capabilities
    // For now, we return a placeholder response

    console.log("BERG Applicability Request:", { articleId, resourceId });

    // Placeholder response - adjust based on actual API
    return NextResponse.json({
      message: "Applicability endpoint not yet implemented in BERG API",
      articleId,
      resourceId,
      applicability: [],
    });
  } catch (error: any) {
    console.error("BERG Applicability Error:", error.message);

    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

