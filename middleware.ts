import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth/session";

// Защищённые разделы (требуют входа; админ-права проверяются на самой странице).
const protectedPaths = ["/dashboard", "/admin"];

function isProtected(pathname: string): boolean {
  return protectedPaths.some((p) => pathname.startsWith(p));
}

// Валидная форма слага лендинга каталога. ТОЛЬКО латиница/цифры/дефис — как в
// CAR_BRAND_META и CATEGORY_META. Всё прочее (кириллица, %-мусор) отсекаем:
// иначе rewrite+canonical перекодируют слаг по кругу (%d0→%25d0→%2525d0…) и
// робот Яндекса плодит бесконечные URL (crawler trap — см. Вебмастер, июль 2026).
const SLUG_RE = /^[a-zA-Z0-9-]+$/;

// Имена марок из старых ссылок (кириллица, пробелы) → латинские слаги
// справочника. Держим синхронно с BRAND_NAME_SLUGS в lib/catalog/urls.ts.
const RU_BRAND_SLUGS: Record<string, string> = {
  "ваз": "lada",
  "лада": "lada",
  "газ": "gaz",
  "уаз": "uaz",
  "москвич": "moskvich",
  "land rover": "land-rover",
};

/**
 * Сегмент пути → канонический слаг: декодируем (битые %-последовательности →
 * null), мапим русские имена, валидируем форму, приводим к нижнему регистру.
 */
function normalizeSlug(raw: string): string | null {
  let s = raw;
  try {
    s = decodeURIComponent(raw);
  } catch {
    return null; // битая %-последовательность
  }
  const mapped = RU_BRAND_SLUGS[s.toLowerCase()];
  if (mapped) return mapped;
  return SLUG_RE.test(s) ? s.toLowerCase() : null;
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Старые query-URL лендингов каталога → чистые пути (301). Прочие параметры
  // (сортировка/страница/фильтры) сохраняем. /catalog?vin=/?article= не трогаем.
  // Мусорное значение (кириллица вне мапы, %-хлам) → 301 на общий /catalog:
  // обрываем ловушку одним хопом, не создавая новых кривых URL.
  if (pathname === "/catalog") {
    const brand = searchParams.get("brand");
    const category = searchParams.get("category");
    if (brand || category) {
      const url = request.nextUrl.clone();
      url.searchParams.delete("brand");
      url.searchParams.delete("category");
      const slug = normalizeSlug(brand ?? category!);
      if (slug) {
        url.pathname = brand
          ? `/catalog/brand/${slug}`
          : `/catalog/category/${slug}`;
      } else {
        url.pathname = "/catalog";
        url.search = ""; // мусорный заход — параметры не тащим
      }
      return NextResponse.redirect(url, 301);
    }
  }

  // Чистые пути лендингов: гасим мусорные слаги (в т.ч. уже проиндексированные
  // Яндексом %2525…-URL — они 301-ятся на /catalog и выпадают из индекса) и
  // канонизируем регистр (/catalog/brand/BMW → /catalog/brand/bmw).
  if (
    pathname.startsWith("/catalog/brand/") ||
    pathname.startsWith("/catalog/category/")
  ) {
    const parts = pathname.split("/"); // ['', 'catalog', 'brand', '<slug>', ...]
    const slug = parts.length === 4 ? normalizeSlug(parts[3]) : null;
    if (!slug) {
      const url = request.nextUrl.clone();
      url.pathname = "/catalog";
      url.search = "";
      return NextResponse.redirect(url, 301);
    }
    if (slug !== parts[3]) {
      // Регистр/кодировка/русское имя → канонический вид (query сохраняем).
      const url = request.nextUrl.clone();
      url.pathname = `/${parts[1]}/${parts[2]}/${slug}`;
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
  // /catalog — 301 старых query-URL на чистые пути; /catalog/brand|category/* —
  // валидация слагов (гашение crawler trap) и канонизация регистра. Остальное —
  // защищённые разделы (проверка входа). API-роуты валидируют сессию сами.
  matcher: [
    "/catalog",
    "/catalog/brand/:path*",
    "/catalog/category/:path*",
    "/dashboard/:path*",
    "/admin/:path*",
  ],
};
