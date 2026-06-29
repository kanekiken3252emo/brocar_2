import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth/session";

// Защищённые разделы (требуют входа; админ-права проверяются на самой странице).
const protectedPaths = ["/dashboard", "/admin"];

function isProtected(pathname: string): boolean {
  return protectedPaths.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  if (isProtected(request.nextUrl.pathname)) {
    // Своя сессия (JWT в cookie), проверка через jose — работает в Edge.
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const user = await verifySessionToken(token);
    if (!user) {
      const url = new URL("/auth/login", request.url);
      url.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  // Запускаем middleware ТОЛЬКО на защищённых разделах — там нужна проверка
  // входа (редирект гостя на /auth/login). API-роуты валидируют сессию сами
  // (lib/api-auth → withAuth), серверные страницы — через lib/auth.
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
