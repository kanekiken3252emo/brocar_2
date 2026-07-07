import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteDomain = process.env.NEXT_PUBLIC_SITE_DOMAIN || "localhost:3000";
  const baseUrl = siteDomain.startsWith("localhost")
    ? `http://${siteDomain}`
    : `https://${siteDomain}`;

  // Техническое зеркало (авто-деплой Vercel) — краулерам вход запрещён целиком.
  if (process.env.VERCEL) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Закрываем от индексации всё служебное и транзакционно-приватное:
      // API, корзину/оформление/оплату, личные разделы и заказы, админку.
      // Каталог, марки, категории, гайды, VIN — остаются открытыми.
      // Без завершающего слэша: "/profile" блокирует и /profile, и /profile/…
      // (со слэшем сам /profile оставался открыт). /payment открыт — это
      // информационная страница о способах оплаты, а не транзакционная.
      disallow: [
        "/api/",
        "/admin",
        "/dashboard",
        "/auth/",
        "/profile",
        "/garage",
        "/cart",
        "/checkout",
        "/order",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
