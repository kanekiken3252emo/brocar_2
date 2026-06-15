"use client";

import { useEffect, useRef } from "react";

/**
 * Виджет онлайн-каталога запчастей по VIN от GoodVin (parts-catalogs.com).
 *
 * Подключается ровно так, как требует поставщик:
 *   <div id="parts-catalog" data-key=... data-back-url=...></div>
 *   <script src="https://gui.parts-catalogs.com/v3/parts-catalogs.js"></script>
 *
 * Скрипт при загрузке ищет в DOM элемент #parts-catalog и монтирует в него
 * каталог. Поскольку у нас App Router (SPA-навигация), DOMContentLoaded при
 * переходе между страницами повторно не срабатывает — поэтому грузим скрипт
 * вручную в useEffect на каждом монтировании и убираем его при размонтировании,
 * чтобы каталог инициализировался при любом заходе на страницу.
 *
 * data-key — публичный ключ виджета (уходит в браузер, секретом не является).
 * Можно переопределить через NEXT_PUBLIC_GOODVIN_KEY, не трогая код.
 */

const SCRIPT_SRC = "https://gui.parts-catalogs.com/v3/parts-catalogs.js";

const WIDGET_KEY =
  process.env.NEXT_PUBLIC_GOODVIN_KEY ||
  "TWS-74EE104F-A08B-45B6-8995-497F5361AD67";

interface GoodvinCatalogWidgetProps {
  /** Куда вести при клике на деталь. {code} заменяется на номер детали. */
  backUrl?: string;
  /** new_window | same_window — открывать карточку детали. */
  target?: string;
  language?: string;
  colorSchema?: string;
  className?: string;
}

export function GoodvinCatalogWidget({
  backUrl = "https://brocarparts.ru/catalog?article={code}",
  target = "new_window",
  language = "ru",
  colorSchema = "red",
  className,
}: GoodvinCatalogWidgetProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.type = "text/javascript";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      script.remove();
      // Подчищаем содержимое контейнера, чтобы при повторном заходе
      // виджет не накладывался на старую отрисовку.
      if (mountRef.current) mountRef.current.innerHTML = "";
    };
  }, []);

  return (
    <div
      ref={mountRef}
      id="parts-catalog"
      data-key={WIDGET_KEY}
      data-target={target}
      data-back-url={backUrl}
      data-language={language}
      data-color-schema={colorSchema}
      className={className ?? "w-full max-w-full"}
    />
  );
}

export default GoodvinCatalogWidget;
