import type { Metadata } from "next";

// Безопасная база для notFound(): неизвестная карточка не должна наследовать
// общий canonical и index, follow. Подтверждённый товар явно переопределяет эти
// поля через generateMetadata в [id]/page.tsx.
export const metadata: Metadata = {
  alternates: {},
  robots: { index: false, follow: true },
};

export default function ProductLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
