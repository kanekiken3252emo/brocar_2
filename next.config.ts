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

const nextConfig: NextConfig = {
  output: "standalone", // Важно для Docker!
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




