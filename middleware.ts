import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
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

  // Protected routes (требуют входа; админ-права проверяются на самой странице)
  const protectedPaths = ["/dashboard", "/admin"];
  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isProtectedPath && !user) {
    const redirectUrl = new URL("/auth/login", request.url);
    redirectUrl.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  // Запускаем middleware ТОЛЬКО на защищённых разделах — там auth.getUser() и
  // нужен (редирект гостя на /auth/login). Раньше matcher ловил ВСЕ страницы и
  // /api, из-за чего supabase.auth.getUser() делал round-trip к Supabase Auth на
  // КАЖДЫЙ запрос (особенно бил по залогиненным на /api/catalog и
  // /api/product-image). API-роуты валидируют JWT сами (lib/api-auth → withAuth),
  // серверные страницы — через lib/auth. Так что сужение безопасно.
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};

