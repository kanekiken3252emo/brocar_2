"use client";

import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Upload,
  Trash2,
  ArrowUp,
  ArrowDown,
  Film,
  Image as ImageIcon,
} from "lucide-react";

export type AdminStory = {
  id: number;
  title: string | null;
  mediaUrl: string;
  mediaType: "image" | "video";
  linkUrl: string | null;
  durationMs: number;
  sortOrder: number;
  isActive: boolean;
};

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={[
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-orange-500" : "bg-neutral-700",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-4 w-4 rounded-full bg-white transition-transform",
          checked ? "translate-x-6" : "translate-x-1",
        ].join(" ")}
      />
    </button>
  );
}

export default function AdminStoriesManager({
  initialStories,
}: {
  initialStories: AdminStory[];
}) {
  const [list, setList] = useState<AdminStory[]>(initialStories);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [durationSec, setDurationSec] = useState(5);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const isVideo = file?.type.startsWith("video/") ?? false;
  const sorted = [...list].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id - b.id
  );

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("Выбери файл — видео или фото");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (title.trim()) fd.append("title", title.trim());
      if (linkUrl.trim()) fd.append("linkUrl", linkUrl.trim());
      fd.append("durationMs", String(Math.round(durationSec * 1000)));
      const res = await fetch("/api/admin/stories", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Ошибка загрузки");
      setList((p) => [...p, data.story as AdminStory]);
      setFile(null);
      setTitle("");
      setLinkUrl("");
      setDurationSec(5);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  }

  async function patch(id: number, body: Record<string, unknown>) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/stories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.story)
        setList((p) =>
          p.map((s) => (s.id === id ? { ...s, ...(data.story as AdminStory) } : s))
        );
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: number) {
    if (!confirm("Удалить историю безвозвратно?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/stories/${id}`, { method: "DELETE" });
      if (res.ok) setList((p) => p.filter((s) => s.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  async function move(id: number, dir: -1 | 1) {
    const i = sorted.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= sorted.length) return;
    const a = sorted[i];
    const b = sorted[j];
    setBusyId(id);
    try {
      await Promise.all([
        fetch(`/api/admin/stories/${a.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder: b.sortOrder }),
        }),
        fetch(`/api/admin/stories/${b.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder: a.sortOrder }),
        }),
      ]);
      setList((p) =>
        p.map((s) =>
          s.id === a.id
            ? { ...s, sortOrder: b.sortOrder }
            : s.id === b.id
            ? { ...s, sortOrder: a.sortOrder }
            : s
        )
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Форма загрузки */}
      <Card className="border-neutral-800 bg-neutral-900">
        <CardContent className="p-5 md:p-6">
          <form onSubmit={handleUpload} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="file">Видео или фото</Label>
              <input
                ref={fileRef}
                id="file"
                type="file"
                accept="image/*,video/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-neutral-300 file:mr-4 file:rounded-lg file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:text-white file:font-semibold hover:file:bg-orange-600 file:cursor-pointer"
              />
              <p className="text-xs text-neutral-500">
                Видео до 60 МБ (лучше вертикальное 9:16, 10–30 сек). Фото
                поджимается автоматически.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">Подпись (необязательно)</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Скидка 20% на масла"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="link">Ссылка «Подробнее» (необязательно)</Label>
                <Input
                  id="link"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="/catalog или https://..."
                />
                <p className="text-xs text-neutral-500">
                  Только относительный путь (/catalog) или полный адрес
                  (https://…).
                </p>
              </div>
            </div>
            {!isVideo && (
              <div className="space-y-1.5">
                <Label htmlFor="dur">
                  Длительность показа фото: {durationSec} сек
                </Label>
                <input
                  id="dur"
                  type="range"
                  min={3}
                  max={15}
                  value={durationSec}
                  onChange={(e) => setDurationSec(Number(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>
            )}
            <Button type="submit" disabled={uploading} className="gap-2">
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {uploading ? "Загрузка…" : "Добавить историю"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Список историй */}
      <div className="space-y-3">
        {sorted.length === 0 && (
          <p className="text-neutral-500 text-sm text-center py-8">
            Историй пока нет. Загрузи первую выше.
          </p>
        )}
        {sorted.map((s, i) => (
          <Card key={s.id} className="border-neutral-800 bg-neutral-900">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-16 w-16 shrink-0 rounded-lg overflow-hidden bg-black flex items-center justify-center ring-1 ring-neutral-800">
                {s.mediaType === "video" ? (
                  <video
                    src={s.mediaUrl}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.mediaUrl}
                    alt={s.title || ""}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    variant={s.mediaType === "video" ? "secondary" : "outline"}
                    className="gap-1"
                  >
                    {s.mediaType === "video" ? (
                      <Film className="h-3 w-3" />
                    ) : (
                      <ImageIcon className="h-3 w-3" />
                    )}
                    {s.mediaType === "video" ? "Видео" : "Фото"}
                  </Badge>
                  {!s.isActive && <Badge variant="warning">Скрыто</Badge>}
                </div>
                <p className="text-sm text-white truncate">
                  {s.title || (
                    <span className="text-neutral-500">Без подписи</span>
                  )}
                </p>
                {s.linkUrl && (
                  <p className="text-xs text-neutral-500 truncate">
                    → {s.linkUrl}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => move(s.id, -1)}
                  disabled={i === 0 || busyId === s.id}
                  className="p-1.5 text-neutral-400 hover:text-white disabled:opacity-30"
                  aria-label="Выше"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  onClick={() => move(s.id, 1)}
                  disabled={i === sorted.length - 1 || busyId === s.id}
                  className="p-1.5 text-neutral-400 hover:text-white disabled:opacity-30"
                  aria-label="Ниже"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <Toggle
                  checked={s.isActive}
                  disabled={busyId === s.id}
                  onChange={() => patch(s.id, { isActive: !s.isActive })}
                />
                <button
                  onClick={() => remove(s.id)}
                  disabled={busyId === s.id}
                  className="p-1.5 text-red-400 hover:text-red-300 disabled:opacity-30 ml-1"
                  aria-label="Удалить"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
