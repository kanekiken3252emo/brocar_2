"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw, Home } from "lucide-react";

/**
 * Глобальный error boundary App Router: ловит ошибки рендера в любой странице
 * под app/ (кроме самого root layout). Раньше упавший рендер каталога (напр.
 * null.toLocaleString() на битой цене) показывал стандартный белый экран
 * «Application error» без выхода. Теперь — аккуратная страница с «Повторить»
 * (reset перемонтирует сегмент) и ссылкой на главную.
 *
 * Держим компонент минимально зависимым (только next/link + иконки) — error
 * boundary должен отрисоваться даже когда что-то в приложении сломано.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Сюда позже можно подключить отправку в Sentry / лог-сервис.
    console.error("Render error boundary:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-orange-500" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">
          Что-то пошло не так
        </h1>
        <p className="text-neutral-400 mb-8 leading-relaxed">
          Произошла ошибка при загрузке страницы. Попробуйте обновить — если не
          поможет, вернитесь на главную, мы уже разбираемся.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            <RotateCw className="w-5 h-5" />
            Попробовать снова
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            <Home className="w-5 h-5" />
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}
