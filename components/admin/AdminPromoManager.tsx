"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  X,
  Tag,
  Power,
  PowerOff,
} from "lucide-react";

export type AdminPromo = {
  id: number;
  code: string;
  discountPct: string; // numeric → строка из БД
  active: boolean;
  startsAt: string | null; // ISO
  expiresAt: string | null; // ISO
  createdAt: string;
};

// ISO → значение для <input type="datetime-local"> в локальном времени.
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Человеческий статус кода по флагу active и срокам. */
function statusOf(p: AdminPromo): { label: string; cls: string } {
  if (!p.active) return { label: "Выключен", cls: "text-neutral-400" };
  const now = Date.now();
  if (p.startsAt && now < new Date(p.startsAt).getTime())
    return { label: "Ещё не начался", cls: "text-yellow-400" };
  if (p.expiresAt && now > new Date(p.expiresAt).getTime())
    return { label: "Истёк", cls: "text-red-400" };
  return { label: "Активен", cls: "text-green-400" };
}

export default function AdminPromoManager({
  initialPromos,
}: {
  initialPromos: AdminPromo[];
}) {
  const [list, setList] = useState<AdminPromo[]>(initialPromos);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [pct, setPct] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const isEditing = editingId !== null;

  function resetForm() {
    setEditingId(null);
    setCode("");
    setPct("");
    setStartsAt("");
    setExpiresAt("");
    setActive(true);
    setError(null);
  }

  function startEdit(p: AdminPromo) {
    setEditingId(p.id);
    setCode(p.code);
    setPct(String(Number(p.discountPct)));
    setStartsAt(toLocalInput(p.startsAt));
    setExpiresAt(toLocalInput(p.expiresAt));
    setActive(p.active);
    setError(null);
    if (typeof window !== "undefined")
      window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function upsertInList(saved: AdminPromo) {
    setList((p) => {
      const next = p.some((x) => x.id === saved.id)
        ? p.map((x) => (x.id === saved.id ? saved : x))
        : [saved, ...p];
      return [...next].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
          b.id - a.id
      );
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const code2 = code.trim().toUpperCase();
    const pctNum = Number(pct);
    if (!code2) return setError("Укажи код");
    if (!Number.isFinite(pctNum) || pctNum < 1 || pctNum > 100)
      return setError("Процент скидки — число от 1 до 100");

    setSaving(true);
    try {
      const payload = {
        code: code2,
        discountPct: pctNum,
        active,
        startsAt: startsAt ? new Date(startsAt).toISOString() : null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      };
      const res = await fetch(
        isEditing ? `/api/admin/promos/${editingId}` : "/api/admin/promos",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.error || `Ошибка сохранения (HTTP ${res.status})`);
      upsertInList(data.promo as AdminPromo);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: AdminPromo) {
    setBusyId(p.id);
    try {
      const res = await fetch(`/api/admin/promos/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !p.active }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.promo) upsertInList(data.promo as AdminPromo);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: number) {
    if (!confirm("Удалить промокод? Уже оформленные заказы не изменятся.")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/promos/${id}`, { method: "DELETE" });
      if (res.ok) {
        setList((p) => p.filter((x) => x.id !== id));
        if (editingId === id) resetForm();
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Форма создания / редактирования */}
      <Card className="border-neutral-800 bg-neutral-900">
        <CardContent className="p-5 md:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">
                {isEditing ? "Редактирование промокода" : "Новый промокод"}
              </h2>
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                  Отмена
                </button>
              )}
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="code">Код</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="SALE10"
                  maxLength={40}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pct">Скидка, %</Label>
                <Input
                  id="pct"
                  type="number"
                  min={1}
                  max={100}
                  value={pct}
                  onChange={(e) => setPct(e.target.value)}
                  placeholder="10"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="starts">Действует с (необязательно)</Label>
                <Input
                  id="starts"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expires">Действует по (необязательно)</Label>
                <Input
                  id="expires"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 accent-orange-500"
              />
              <span className="text-sm text-neutral-300">
                Активен (работает на сайте)
              </span>
            </label>

            <p className="text-xs text-neutral-500">
              Пустые даты — без ограничения по сроку (с этой стороны). Код
              сравнивается без учёта регистра.
            </p>

            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isEditing ? (
                <Pencil className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {saving
                ? "Сохранение…"
                : isEditing
                ? "Сохранить изменения"
                : "Добавить промокод"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {list.length === 0 ? (
        <p className="text-neutral-500 text-sm text-center py-8">
          Промокодов пока нет. Добавь первый выше.
        </p>
      ) : (
        <div className="space-y-3">
          {list.map((p) => {
            const st = statusOf(p);
            return (
              <Card
                key={p.id}
                className={[
                  "border-neutral-800 bg-neutral-900",
                  editingId === p.id ? "ring-1 ring-orange-500/50" : "",
                ].join(" ")}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Tag className="h-4 w-4 text-orange-500 shrink-0" />
                      <span className="font-mono font-bold text-white">
                        {p.code}
                      </span>
                      <Badge variant="outline">−{Number(p.discountPct)}%</Badge>
                      <span className={`text-xs font-medium ${st.cls}`}>
                        {st.label}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500">
                      Срок: {fmt(p.startsAt)} — {fmt(p.expiresAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {busyId === p.id ? (
                      <div className="p-1.5">
                        <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => toggleActive(p)}
                          className={`p-1.5 ${p.active ? "text-green-400 hover:text-green-300" : "text-neutral-500 hover:text-white"}`}
                          title={p.active ? "Выключить" : "Включить"}
                        >
                          {p.active ? (
                            <Power className="h-4 w-4" />
                          ) : (
                            <PowerOff className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => startEdit(p)}
                          className="p-1.5 text-neutral-400 hover:text-white"
                          title="Редактировать"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => remove(p.id)}
                          className="p-1.5 text-red-400 hover:text-red-300"
                          title="Удалить"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
