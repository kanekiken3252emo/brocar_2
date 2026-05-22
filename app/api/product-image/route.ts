import { NextRequest, NextResponse } from "next/server";
import { getOrFetchProductImage } from "@/lib/product-images";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const brand = searchParams.get("brand")?.trim() || "";
  const article = searchParams.get("article")?.trim() || "";

  if (!brand || !article) {
    return NextResponse.json(
      { error: "brand и article обязательны" },
      { status: 400 }
    );
  }

  try {
    const url = await getOrFetchProductImage(brand, article);
    // На деве отключаем кэш, чтобы повторные запросы реально шли на сервер.
    // На проде кэшируем на час — URL ведёт в Supabase Storage CDN, картинка
    // сама по себе уже кэширована, а тут мы экономим вызов в БД.
    const cacheControl =
      process.env.NODE_ENV === "production"
        ? "public, max-age=3600, s-maxage=3600"
        : "no-store";
    return NextResponse.json(
      { url },
      { headers: { "Cache-Control": cacheControl } }
    );
  } catch (error) {
    console.error("/api/product-image error:", error);
    return NextResponse.json(
      { error: "Не удалось получить картинку" },
      { status: 500 }
    );
  }
}
