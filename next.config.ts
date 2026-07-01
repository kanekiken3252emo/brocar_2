import type { NextConfig } from "next";

// Хост S3-хранилища картинок (VK Cloud Object Storage) — берём из S3_PUBLIC_BASE,
// чтобы next/image мог оптимизировать картинки оттуда.
function s3PublicHost(): string {
  const url = process.env.S3_PUBLIC_BASE;
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

const s3Host = s3PublicHost();

// Домен сайта (без www). Нужен для 301 www → non-www ниже. На localhost
// редирект не добавляем (незачем и некуда).
const siteDomain = process.env.NEXT_PUBLIC_SITE_DOMAIN || "localhost:3000";
const isRealDomain = !siteDomain.startsWith("localhost");

// Заголовки безопасности на все ответы. CSP сюда СОЗНАТЕЛЬНО не добавляем —
// он легко ломает inline-стили/скрипты Next и требует отдельной аккуратной
// настройки. HSTS реально работает только поверх HTTPS (на localhost браузер
// его игнорирует), поэтому здесь он безвреден, а на проде даёт эффект.
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  output: "standalone", // Важно для Docker!
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  async redirects() {
    // 301 www → non-www (устраняем дубль хоста). Работает при условии, что
    // nginx проксирует исходный Host (proxy_set_header Host $host) — тогда Next
    // видит www.<домен> и редиректит на канонический non-www.
    // Редиректы старых /catalog?brand=/?category= → чистые пути делаем в
    // middleware (там можно стрипнуть query и привести слаг к нижнему регистру).
    if (!isRealDomain) return [];
    return [
      {
        source: "/:path*",
        has: [{ type: "host" as const, value: `www.${siteDomain}` }],
        destination: `https://${siteDomain}/:path*`,
        permanent: true,
      },
    ];
  },
  async rewrites() {
    // Чистые лендинги каталога внутри обслуживаются той же /catalog-страницей
    // с query-параметром (rewrite не меняет URL в адресной строке). Логику
    // каталога/CatalogClient трогать не нужно.
    return [
      { source: "/catalog/brand/:slug", destination: "/catalog?brand=:slug" },
      {
        source: "/catalog/category/:slug",
        destination: "/catalog?category=:slug",
      },
    ];
  },
  // sharp — нативный модуль. В standalone-трейсинг его платформенные бинарники
  // (@img/*, .node) не всегда попадают: JS-часть есть, а бинаря нет — и на проде
  // падает и наш import("sharp") (картинки сохранялись оригиналами вместо webp),
  // и оптимизатор next/image (отдаёт неоптимизированный оригинал в браузер).
  // Принудительно включаем sharp и его бинарники в бандл. См.
  // https://nextjs.org/docs/messages/sharp-missing-in-production
  outputFileTracingIncludes: {
    "/api/product-image": [
      "./node_modules/sharp/**/*",
      "./node_modules/@img/**/*",
    ],
    "/api/**": ["./node_modules/sharp/**/*", "./node_modules/@img/**/*"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    // Точечные импорты иконок lucide-react (~50 client-компонентов) вместо
    // тяжёлого barrel-индекса — меньше JS в клиентских чанках первого экрана.
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    // Сколько next/image держит оптимизированную картинку в своём кэше, даже
    // если у источника короткий/отсутствует Cache-Control. 31 день — чтобы
    // не передёргивать VK Storage и не «подмаргивать» картинками на повторах.
    minimumCacheTTL: 2678400,
    remotePatterns: [
      ...(s3Host
        ? ([
            {
              protocol: "https" as const,
              hostname: s3Host,
              pathname: "/**",
            },
          ])
        : []),
    ],
  },
};

export default nextConfig;




