import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: process.env.NEXT_PUBLIC_SITE_NAME || "BroCar",
    short_name: "BroCar",
    description:
      "Профессиональный поставщик автозапчастей. Широкий ассортимент, конкурентные цены, быстрая доставка.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#f97316",
    icons: [
      { src: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { src: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { src: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { src: "/favicon.png",       sizes: "any",   type: "image/png" },
    ],
  };
}




