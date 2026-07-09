"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Percent,
  Check,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

type Reprice = {
  state: "idle" | "running" | "done" | "error";
  progress: string;
  finishedAt: string | null;
};

export default function AdminPricingManager({
  initialPct,
  initialReprice,
}: {
  initialPct: number;
  initialReprice: Reprice;
}) {
  const [pct, setPct] = useState(String(initialPct));
  const [savedPct, setSavedPct] = useState(initialPct);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reprice, setReprice] = useState<Reprice>(initialReprice);
  const [applying, setApplying] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const parsed = parseFloat(pct);
  const valid = Number.isFinite(parsed) && parsed >= 0 && parsed <= 300;
  const dirty = valid && parsed !== savedPct;

  // Пока идёт пересчёт — опрашиваем статус раз в 2с.
  useEffect(() => {
    if (reprice.state !== "running") return;
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch("/api/admin/pricing", { cache: "no-store" });
        if (r.ok) {
          const d = await r.json();
          setReprice(d.reprice);
        }
      } catch {
        /* сеть моргнула — на следующем тике повторим */
      }
    }, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [reprice.state]);

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    setError(null);
    setSavedOk(false);
    try {
      const r = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pct: parsed }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Не удалось сохранить");
      setSavedPct(d.pct);
      setPct(String(d.pct));
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const apply = async () => {
    setApplying(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/pricing/apply", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Не удалось запустить пересчёт");
      setReprice(d.reprice);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setApplying(false);
    }
  };

  const running = reprice.state === "running";

  return (
    <div className="space-y-6">
      {/* Наценка */}
      <Card className="border-neutral-800 bg-neutral-900">
        <CardContent className="p-6 space-y-5">
          <div>
            <Label htmlFor="pct" className="text-white">
              Наценка на весь каталог
            </Label>
            <p className="text-neutral-400 text-sm mt-1 leading-relaxed">
              Процент, который прибавляется к закупочной цене поставщика. Например
              при закупке 1000&nbsp;₽ и наценке&nbsp;38% цена на сайте будет
              1380&nbsp;₽.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <div className="relative">
                <Input
                  id="pct"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={300}
                  step={1}
                  value={pct}
                  onChange={(e) => setPct(e.target.value)}
                  className="pr-9 text-lg font-semibold"
                />
                <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              </div>
            </div>
            <Button onClick={save} disabled={!dirty || saving} className="gap-2">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : savedOk ? (
                <Check className="h-4 w-4" />
              ) : null}
              {savedOk ? "Сохранено" : "Сохранить"}
            </Button>
          </div>

          {!valid && pct !== "" && (
            <p className="text-sm text-amber-400">
              Введите число от 0 до 300.
            </p>
          )}

          <div className="flex items-start gap-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 p-3.5">
            <Check className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-sm text-neutral-300 leading-relaxed">
              После сохранения новая наценка сразу применяется к ценам на
              карточках товаров. Чтобы обновить цены и в общем каталоге (списки,
              фильтры по цене) — нажмите «Пересчитать каталог» ниже.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Пересчёт каталога */}
      <Card className="border-neutral-800 bg-neutral-900">
        <CardContent className="p-6 space-y-4">
          <div>
            <h2 className="text-white font-semibold">Пересчитать каталог</h2>
            <p className="text-neutral-400 text-sm mt-1 leading-relaxed">
              Применяет текущую наценку ко всем ценам в базе (около 2&nbsp;млн
              позиций). Занимает несколько минут — можно закрыть страницу, пересчёт
              продолжится на сервере. Каталог и так пересчитывается каждую ночь при
              загрузке прайсов — эта кнопка нужна, если цены нужны прямо сейчас.
            </p>
          </div>

          <Button
            onClick={apply}
            disabled={running || applying}
            variant="outline"
            className="gap-2"
          >
            {running || applying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {running ? "Идёт пересчёт…" : "Пересчитать каталог"}
          </Button>

          {running && (
            <div className="flex items-center gap-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 p-3.5">
              <Loader2 className="h-4 w-4 text-orange-400 shrink-0 animate-spin" />
              <p className="text-sm text-neutral-300">{reprice.progress}</p>
            </div>
          )}
          {reprice.state === "done" && !running && (
            <div className="flex items-center gap-2.5 rounded-xl bg-green-500/10 border border-green-500/20 p-3.5">
              <Check className="h-4 w-4 text-green-400 shrink-0" />
              <p className="text-sm text-neutral-300">
                {reprice.progress}
                {reprice.finishedAt && (
                  <span className="text-neutral-500">
                    {" · "}
                    {new Date(reprice.finishedAt).toLocaleString("ru-RU")}
                  </span>
                )}
              </p>
            </div>
          )}
          {reprice.state === "error" && !running && (
            <div className="flex items-center gap-2.5 rounded-xl bg-red-500/10 border border-red-500/20 p-3.5">
              <TriangleAlert className="h-4 w-4 text-red-400 shrink-0" />
              <p className="text-sm text-neutral-300">
                Пересчёт не завершился: {reprice.progress}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2.5 rounded-xl bg-red-500/10 border border-red-500/20 p-3.5">
          <TriangleAlert className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-sm text-neutral-300">{error}</p>
        </div>
      )}
    </div>
  );
}
