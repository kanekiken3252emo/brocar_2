"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Cookie, X, Settings, Check, ShieldCheck, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── types ────────────────────────────────────────────────────────────────────

interface CookieConsent {
  necessary: true;
  analytics: boolean;
  functional: boolean;
  timestamp: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = "brocar-cookie-consent";

function readConsent(): CookieConsent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CookieConsent) : null;
  } catch {
    return null;
  }
}

function writeConsent(partial: { analytics: boolean; functional: boolean }) {
  const consent: CookieConsent = {
    necessary: true,
    ...partial,
    timestamp: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  } catch {
    // storage blocked — ignore
  }
  return consent;
}

// ─── toggle ───────────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
  id,
}: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!checked)}
      className={[
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full",
        "transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/40",
        checked ? "bg-orange-500" : "bg-neutral-700",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200",
          checked ? "translate-x-6" : "translate-x-1",
        ].join(" ")}
      />
    </button>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [functional, setFunctional] = useState(true);

  // Show banner only if no consent recorded yet
  useEffect(() => {
    if (!readConsent()) setVisible(true);
  }, []);

  function save(opts: { analytics: boolean; functional: boolean }) {
    writeConsent(opts);
    setVisible(false);
    setSettingsOpen(false);
  }

  function acceptAll() {
    save({ analytics: true, functional: true });
  }

  function declineAll() {
    save({ analytics: false, functional: false });
  }

  function saveSettings() {
    save({ analytics, functional });
  }

  function openSettings() {
    // Pre-fill toggles from current stored consent (if any), fallback to false
    const stored = readConsent();
    setAnalytics(stored ? stored.analytics : false);
    setFunctional(stored ? stored.functional : false);
    setSettingsOpen(true);
  }

  if (!visible) return null;

  return (
    <>
      {/* ── Settings modal ─────────────────────────────────────────────────── */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && setSettingsOpen(false)}
        >
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-orange-500/20 rounded-lg flex items-center justify-center shrink-0">
                  <Settings className="h-4 w-4 text-orange-500" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white leading-none">Настройки Cookie</h2>
                  <p className="text-xs text-neutral-500 mt-0.5">Управляйте вашими предпочтениями</p>
                </div>
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Categories */}
            <div className="p-6 space-y-3">
              {/* Necessary — always on */}
              <div className="flex items-start justify-between gap-4 p-4 bg-neutral-800/40 rounded-xl border border-neutral-700/40">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <ShieldCheck className="h-4 w-4 text-orange-500 shrink-0" />
                    <span className="font-semibold text-white text-sm">Необходимые</span>
                    <span className="text-[11px] text-neutral-400 bg-neutral-700 rounded-md px-1.5 py-0.5 leading-none">
                      Всегда включены
                    </span>
                  </div>
                  <p className="text-neutral-400 text-xs leading-relaxed">
                    Авторизация, корзина, безопасность сессии. Без них сайт не работает.
                  </p>
                </div>
                <div className="pt-0.5">
                  <Toggle checked disabled />
                </div>
              </div>

              {/* Analytics */}
              <div className="flex items-start justify-between gap-4 p-4 bg-neutral-800/40 rounded-xl border border-neutral-700/40">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm mb-1.5">Аналитические</p>
                  <p className="text-neutral-400 text-xs leading-relaxed">
                    Помогают понять, как посетители используют сайт, чтобы улучшать его работу.
                    Данные анонимны.
                  </p>
                </div>
                <div className="pt-0.5">
                  <Toggle checked={analytics} onChange={setAnalytics} />
                </div>
              </div>

              {/* Functional */}
              <div className="flex items-start justify-between gap-4 p-4 bg-neutral-800/40 rounded-xl border border-neutral-700/40">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm mb-1.5">Функциональные</p>
                  <p className="text-neutral-400 text-xs leading-relaxed">
                    Запоминают ваши предпочтения (регион, валюта) для удобства работы с сайтом.
                  </p>
                </div>
                <div className="pt-0.5">
                  <Toggle checked={functional} onChange={setFunctional} />
                </div>
              </div>

              <p className="text-neutral-600 text-xs pt-1">
                Подробнее —{" "}
                <Link
                  href="/legal/cookies"
                  className="text-orange-500/80 hover:text-orange-500 underline underline-offset-2"
                  onClick={() => setSettingsOpen(false)}
                >
                  Политика Cookie
                </Link>
              </p>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 pb-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={declineAll}
              >
                Отклонить все
              </Button>
              <Button className="flex-1 gap-2" onClick={saveSettings}>
                <Check className="h-4 w-4" />
                Сохранить выбор
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Banner ─────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-3 sm:p-4">
        <div className="max-w-5xl mx-auto bg-neutral-900 border border-neutral-700/70 rounded-2xl shadow-2xl shadow-black/60">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 sm:p-5">

            {/* Icon + text */}
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-9 h-9 bg-orange-500/20 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <Cookie className="h-4 w-4 text-orange-500" />
              </div>
              <p className="text-sm text-neutral-300 leading-relaxed">
                Мы используем cookie для улучшения работы сайта и анализа трафика.{" "}
                <Link
                  href="/legal/cookies"
                  className="inline-flex items-center gap-0.5 text-orange-500 hover:text-orange-400 underline underline-offset-2 transition-colors"
                >
                  Подробнее
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </p>
            </div>

            {/* Buttons */}
            <div className="flex flex-wrap gap-2 w-full sm:w-auto shrink-0">
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-neutral-400 hover:text-white flex-1 sm:flex-none"
                onClick={openSettings}
              >
                <Settings className="h-3.5 w-3.5" />
                Настроить
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={declineAll}
              >
                Отклонить
              </Button>
              <Button
                size="sm"
                className="gap-1.5 flex-1 sm:flex-none"
                onClick={acceptAll}
              >
                <Check className="h-3.5 w-3.5" />
                Принять все
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── public helper ────────────────────────────────────────────────────────────
// Use this anywhere in the app to read the current consent state.
export function getCookieConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  return readConsent();
}
