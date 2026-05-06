"use client";

import { useEffect, useRef, useState } from "react";

interface AcatCatalogWidgetProps {
  src?: string;
  initialHeight?: number;
  className?: string;
}

const DEFAULT_SRC =
  process.env.NEXT_PUBLIC_ACAT_WIDGET_URL || "https://brocarparts.acat.online";

export function AcatCatalogWidget({
  src = DEFAULT_SRC,
  initialHeight = 800,
  className,
}: AcatCatalogWidgetProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number>(initialHeight);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      try {
        const allowedOrigin = new URL(src).origin;
        if (event.origin !== allowedOrigin) return;

        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;

        if (!data || typeof data !== "object") return;

        if (typeof data.acatFrameHeight === "number") {
          setHeight(data.acatFrameHeight);
        }

        if (typeof data.acatScrollTop === "number" && frameRef.current) {
          const frameTop =
            frameRef.current.getBoundingClientRect().top + window.scrollY;
          window.scrollTo({
            top: frameTop + data.acatScrollTop,
            behavior: "smooth",
          });
        }
      } catch {
        // Ignore non-JSON messages from other widgets/extensions.
      }
    }

    window.addEventListener("message", handleMessage, false);
    return () => window.removeEventListener("message", handleMessage, false);
  }, [src]);

  function handleLoad() {
    if (!frameRef.current) return;
    const frameTop =
      frameRef.current.getBoundingClientRect().top + window.scrollY;
    if (window.scrollY > frameTop) {
      window.scrollTo({ top: frameTop, behavior: "smooth" });
    }
  }

  return (
    <iframe
      ref={frameRef}
      id="acat-frame"
      title="Каталог запчастей по VIN"
      src={src}
      width="100%"
      height={height}
      scrolling="auto"
      frameBorder={0}
      onLoad={handleLoad}
      allow="clipboard-read; clipboard-write"
      className={
        className ??
        "w-full max-w-full bg-neutral-950"
      }
      style={{ height }}
    />
  );
}

export default AcatCatalogWidget;
