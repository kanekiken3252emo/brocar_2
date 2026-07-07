import type { Metadata } from "next";

// Страница vin-search — клиентский компонент и не может экспортировать metadata,
// поэтому SEO-мета живёт в layout. Это посадочная под запрос «запчасти по VIN».
export const metadata: Metadata = {
  title: "Подбор запчастей по VIN — бесплатная заявка",
  description:
    "Отправьте VIN — подберём запчасти для вашего авто: оригинал и аналоги, цены и сроки. Бесплатный подбор от специалистов BroCar. Доставка по России!",
};

export default function VinSearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
