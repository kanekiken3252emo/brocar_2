import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { HeaderWrapper } from "@/components/header-wrapper";
import { Footer } from "@/components/footer";

const inter = Inter({ 
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
});

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "BroCar";
const siteDomain = process.env.NEXT_PUBLIC_SITE_DOMAIN || "localhost:3000";
const baseUrl = siteDomain.startsWith("localhost")
  ? `http://${siteDomain}`
  : `https://${siteDomain}`;

export const metadata: Metadata = {
  title: {
    default: `${siteName} - Автозапчасти`,
    template: `%s | ${siteName}`,
  },
  description:
    "Профессиональный поставщик автозапчастей. Широкий ассортимент, конкурентные цены, быстрая доставка.",
  keywords: ["автозапчасти", "запчасти", "автомобили", "BroCar"],
  authors: [{ name: siteName }],
  metadataBase: new URL(baseUrl),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark">
      <body className={`${inter.variable} font-sans flex flex-col min-h-screen bg-neutral-950`}>
        <HeaderWrapper />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
