import type { Metadata } from "next";

// Приватная страница: свой title вместо дубля дефолтного + noindex.
export const metadata: Metadata = {
  title: "Профиль",
  robots: { index: false, follow: false },
};

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
