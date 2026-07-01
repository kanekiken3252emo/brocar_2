import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth/session";

// Защищённые разделы (требуют входа; админ-права проверяются на самой странице).
const protectedPaths = ["/dashboard", "/admin"];

function isProtected(pathname: string): boolean {
  return protectedPaths.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Старые query-URL лендингов каталога → чистые пути (301). Стрипаем
  // brand/category и приводим слаг к нижнему регистру; прочие параметры
  // (сортировка/страница/фильтры) сохраняем. Сам /catalog?vin=/?article= — без
  // brand/category — остаётся как есть (поиск/VIN живут на query).
  if (pathname === "/catalog") {
    const brand = searchParams.get("brand");
    const category = searchParams.get("category");
    if (brand || category) {
      const url = request.nextUrl.clone();
      const slug = encodeURIComponent((brand ?? category)!.toLowerCase());
      url.pathname = brand
        ? `/catalog/brand/${slug}`
        : `/catalog/category/${slug}`;
      url.searchParams.delete("brand");
      url.searchParams.delete("category");
      return NextResponse.redirect(url, 301);
    }
  }

  if (isProtected(pathname)) {
    // Своя сессия (JWT в cookie), проверка через jose — работает в Edge.
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const user = await verifySessionToken(token);
    if (!user) {
      const url = new URL("/auth/login", request.url);
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  // /catalog — для 301-редиректа старых query-URL на чистые пути (только сам
  // /catalog, не /catalog/brand/*). Остальное — защищённые разделы (проверка
  // входа). API-роуты валидируют сессию сами, серверные страницы — через lib/auth.
  matcher: ["/catalog", "/dashboard/:path*", "/admin/:path*"],
};
