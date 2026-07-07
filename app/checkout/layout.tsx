import type { Metadata } from "next";

// Транзакционная страница: свой title вместо дубля дефолтного + noindex.
export const metadata: Metadata = {
  title: "Оформление заказа",
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
