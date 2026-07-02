import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { HeaderWrapper } from "@/components/header-wrapper";
import { Footer } from "@/components/footer";
import { CookieBanner } from "@/components/cookie-banner";
import CartToast from "@/components/CartToast";
import FlashToast from "@/components/FlashToast";
import NavProgress from "@/components/NavProgress";
import { JsonLd } from "@/components/seo/JsonLd";
import { organizationSchema, websiteSchema } from "@/lib/seo/structured-data";
import YandexMetrika from "@/components/YandexMetrika";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  // Только реально используемые начертания (в разметке нет font-light/extrabold/
  // black). Раньше грузилось 7 весов × 2 субсета = до 14 woff2 впустую.
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

// Origin S3-хранилища картинок (VK Cloud) — для preconnect/dns-prefetch, чтобы
// браузер заранее открыл соединение к CDN и первая картинка грида пришла быстрее.
function imageCdnOrigin(): string | null {
  const base = process.env.S3_PUBLIC_BASE;
  if (!base) return null;
  try {
    return new URL(base).origin;
  } catch {
    return null;
  }
}
const cdnOrigin = imageCdnOrigin();

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "BroCar";
const siteDomain = process.env.NEXT_PUBLIC_SITE_DOMAIN || "localhost:3000";
const baseUrl = siteDomain.startsWith("localhost")
  ? `http://${siteDomain}`
  : `https://${siteDomain}`;

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: `Качественные автозапчасти для вашего авто | ${siteName}`,
    template: `%s | ${siteName}`,
  },
  description:
    "Профессиональный поставщик автозапчастей. Широкий ассортимент, конкурентные цены, быстрая доставка.",
  keywords: ["автозапчасти", "запчасти", "автомобили", "BroCar"],
  authors: [{ name: siteName }],
  metadataBase: new URL(baseUrl),
  // "./" — Next.js сам подставит canonical с путём текущей страницы
  // (query-параметры отбрасываются: /catalog?brand=Audi → /catalog)
  alternates: {
    canonical: "./",
  },
  // Подтверждение прав в Яндекс.Вебмастере (мета-метод). Дублируется файлом
  // public/yandex_94342307740d8160.html — верификация пройдёт любым способом.
  verification: {
    yandex: "94342307740d8160",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  // og:title / og:description Next сам подставит из title/description каждой
  // страницы (шаблон «%s | BroCar» уже применён). Здесь — общие для всех полей:
  // тип, имя сайта, локаль и картинка-превью (public/og-image.png, 1200×630).
  openGraph: {
    type: "website",
    siteName,
    locale: "ru_RU",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${siteName} — интернет-магазин автозапчастей`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png" },
      { url: "/apple-touch-icon-57x57.png",  sizes: "57x57"  },
      { url: "/apple-touch-icon-60x60.png",  sizes: "60x60"  },
      { url: "/apple-touch-icon-72x72.png",  sizes: "72x72"  },
      { url: "/apple-touch-icon-76x76.png",  sizes: "76x76"  },
      { url: "/apple-touch-icon-114x114.png", sizes: "114x114" },
      { url: "/apple-touch-icon-120x120.png", sizes: "120x120" },
      { url: "/apple-touch-icon-144x144.png", sizes: "144x144" },
      { url: "/apple-touch-icon-152x152.png", sizes: "152x152" },
      { url: "/apple-touch-icon-180x180.png", sizes: "180x180" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark">
      <body className={`${inter.variable} font-sans flex flex-col min-h-screen bg-neutral-950`}>
        {/* Организация (AutoPartsStore) + сайт с поиском — на всех страницах. */}
        <JsonLd data={[organizationSchema(), websiteSchema()]} />
        {/* Прогрев соединения к CDN картинок (React 19 поднимает link в <head>).
            Без crossOrigin — картинки грузятся обычным <img> в non-CORS режиме. */}
        {cdnOrigin && (
          <>
            <link rel="preconnect" href={cdnOrigin} />
            <link rel="dns-prefetch" href={cdnOrigin} />
          </>
        )}
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <HeaderWrapper />
        <main className="flex-1">{children}</main>
        <Footer />
        <CookieBanner />
        {/* Метрика включается только при согласии на аналитические cookie. */}
        <YandexMetrika />
        <CartToast />
        <FlashToast />
      </body>
    </html>
  );
}
