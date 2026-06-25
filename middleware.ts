import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isLocalAuth } from "@/lib/auth/config";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth/session";

// Защищённые разделы (требуют входа; админ-права проверяются на самой странице).
const protectedPaths = ["/dashboard", "/admin"];

function isProtected(pathname: string): boolean {
  return protectedPaths.some((p) => pathname.startsWith(p));
}

function loginRedirect(request: NextRequest): NextResponse {
  const url = new URL("/auth/login", request.url);
  url.searchParams.set("redirect", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  // ── Local-режим: своя cookie (JWT), проверка через jose (работает в Edge) ──
  if (isLocalAuth()) {
    if (isProtected(request.nextUrl.pathname)) {
      const token = request.cookies.get(SESSION_COOKIE)?.value;
      const user = await verifySessionToken(token);
      if (!user) return loginRedirect(request);
    }
    return NextResponse.next();
  }

  // ── Supabase-режим (как было): обновляем сессию + защита разделов ──
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isProtected(request.nextUrl.pathname) && !user) {
    return loginRedirect(request);
  }

  return response;
}

export const config = {
  // Запускаем middleware ТОЛЬКО на защищённых разделах — там нужна проверка
  // входа (редирект гостя на /auth/login). API-роуты валидируют сессию сами
  // (lib/api-auth → withAuth), серверные страницы — через lib/auth.
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
