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

const nextConfig: NextConfig = {
  output: "standalone", // Важно для Docker!
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  images: {
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
    ],
  },
};

export default nextConfig;




