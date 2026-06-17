import type { NextConfig } from "next";

// Хост Supabase Storage берём из NEXT_PUBLIC_SUPABASE_URL, чтобы при смене
// проекта картинки не пришлось хардкодить отдельно.
function supabaseStorageHost(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

const storageHost = supabaseStorageHost();

// Хост S3-хранилища картинок (VK Cloud Object Storage) — берём из S3_PUBLIC_BASE,
// чтобы next/image мог оптимизировать картинки оттуда. Supabase-хост оставляем
// тоже: старые картинки ещё ссылаются на него (переходный период).
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
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  images: {
    // Сколько next/image держит оптимизированную картинку в своём кэше, даже
    // если у источника короткий/отсутствует Cache-Control. 31 день — чтобы
    // не передёргивать VK Storage и не «подмаргивать» картинками на повторах.
    minimumCacheTTL: 2678400,
    remotePatterns: [
      ...(storageHost
        ? ([
            {
              protocol: "https" as const,
              hostname: storageHost,
              pathname: "/storage/v1/object/public/**",
            },
          ])
        : []),
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




