import type { Metadata } from "next";

// Транзакционная страница: свой title вместо дубля дефолтного + noindex
// (robots.txt disallow не запрещает индексацию URL по внешним ссылкам).
export const metadata: Metadata = {
  title: "Корзина",
  robots: { index: false, follow: false },
};

export default function CartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
