import type { Metadata } from "next";

// Безопасная база для notFound(): 404 не должна наследовать общий canonical и
// index, follow из корневого layout. Валидная страница каталога явно задаёт
// собственные robots и canonical через generateMetadata в page.tsx.
export const metadata: Metadata = {
  alternates: {},
  robots: { index: false, follow: true },
};

export default function CatalogLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
