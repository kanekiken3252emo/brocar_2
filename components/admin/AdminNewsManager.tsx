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
  CalendarDays,
  Archive,
  ArchiveRestore,
  ChevronDown,
  Globe,
} from "lucide-react";

// Сколько свежих новостей реально показывается на главной (см. NewsSection,
// .limit(6)). На сайте видны только неархивные и только первые 6 из них.
const HOMEPAGE_LIMIT = 6;

export type AdminNews = {
  id: number;
  title: string;
  body: string;
  badge: string | null;
  archived: boolean;
  publishedAt: string; // ISO
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ISO → значение для <input type="datetime-local"> в локальном времени.
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

const textareaClass =
  "flex min-h-[110px] w-full rounded-xl border border-neutral-700 bg-neutral-800/50 px-4 py-2.5 text-base md:text-sm text-white shadow-sm transition-all duration-300 placeholder:text-neutral-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export default function AdminNewsManager({
  initialNews,
}: {
  initialNews: AdminNews[];
}) {
  const [list, setList] = useState<AdminNews[]>(initialNews);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [badge, setBadge] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showArchive, setShowArchive] = useState(false);

  const isEditing = editingId !== null;

  // Список держим отсортированным (свежие сверху) — см. handleSubmit.
  // Активные новости (на сайте) и архив разделяем по флагу archived.
  const liveNews = list.filter((n) => !n.archived);
  const archivedNews = list.filter((n) => n.archived);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setBody("");
    setBadge("");
    setPublishedAt("");
    setError(null);
  }

  function startEdit(item: AdminNews) {
    setEditingId(item.id);
    setTitle(item.title);
    setBody(item.body);
    setBadge(item.badge ?? "");
    setPublishedAt(toLocalInput(item.publishedAt));
    setError(null);
    if (typeof window !== "undefined")
      window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !body.trim()) {
      setError("Заполни заголовок и текст новости");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        body: body.trim(),
        badge: badge.trim() || null,
        // datetime-local → ISO; пусто = сервер поставит now() (только при создании).
        publishedAt: publishedAt ? new Date(publishedAt).toISOString() : "",
      };

      const res = await fetch(
        isEditing ? `/api/admin/news/${editingId}` : "/api/admin/news",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.error || `Ошибка сохранения (HTTP ${res.status})`);

      const saved = data.news as AdminNews;
      setList((p) => {
        const next = isEditing
          ? p.map((n) => (n.id === saved.id ? saved : n))
          : [saved, ...p];
        return [...next].sort(
          (a, b) =>
            new Date(b.publishedAt).getTime() -
              new Date(a.publishedAt).getTime() || b.id - a.id
        );
      });
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  // Мягкое удаление / возврат: меняем флаг archived, новость остаётся в БД.
  async function setArchived(id: number, archived: boolean) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/news/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.news) {
        setList((p) =>
          p.map((n) => (n.id === id ? (data.news as AdminNews) : n))
        );
        if (editingId === id) resetForm();
      }
    } finally {
      setBusyId(null);
    }
  }

  // Безвозвратное удаление — только из архива.
  async function remove(id: number) {
    if (!confirm("Удалить новость из архива безвозвратно?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/news/${id}`, { method: "DELETE" });
      if (res.ok) {
        setList((p) => p.filter((n) => n.id !== id));
        if (editingId === id) resetForm();
      }
    } finally {
      setBusyId(null);
    }
  }

  const renderCard = (n: AdminNews) => (
    <Card
      key={n.id}
      className={[
        "border-neutral-800 bg-neutral-900",
        editingId === n.id ? "ring-1 ring-orange-500/50" : "",
      ].join(" ")}
    >
      <CardContent className="p-4 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-neutral-500 text-xs mb-1.5">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            <span>{formatDate(n.publishedAt)}</span>
            {n.badge && (
              <Badge variant="outline" className="ml-1">
                {n.badge}
              </Badge>
            )}
          </div>
          <p className="font-semibold text-white text-sm mb-1">{n.title}</p>
          <p className="text-neutral-400 text-sm leading-relaxed line-clamp-3">
            {n.body}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {busyId === n.id ? (
            <div className="p-1.5">
              <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
            </div>
          ) : n.archived ? (
            <>
              <button
                onClick={() => setArchived(n.id, false)}
                className="p-1.5 text-green-400 hover:text-green-300"
                aria-label="Вернуть на сайт"
                title="Вернуть на сайт"
              >
                <ArchiveRestore className="h-4 w-4" />
              </button>
              <button
                onClick={() => remove(n.id)}
                className="p-1.5 text-red-400 hover:text-red-300"
                aria-label="Удалить безвозвратно"
                title="Удалить безвозвратно"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => startEdit(n)}
                className="p-1.5 text-neutral-400 hover:text-white"
                aria-label="Редактировать"
                title="Редактировать"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => setArchived(n.id, true)}
                className="p-1.5 text-neutral-400 hover:text-orange-400"
                aria-label="В архив"
                title="В архив (убрать с сайта)"
              >
                <Archive className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Форма создания / редактирования */}
      <Card className="border-neutral-800 bg-neutral-900">
        <CardContent className="p-5 md:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">
                {isEditing ? "Редактирование новости" : "Новая новость"}
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

            <div className="space-y-1.5">
              <Label htmlFor="title">Заголовок</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например: Новый график работы"
                maxLength={200}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="body">Текст новости</Label>
              <textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Коротко и по делу — пара предложений."
                className={textareaClass}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="badge">Метка (необязательно)</Label>
                <Input
                  id="badge"
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                  placeholder="Акция / Режим работы"
                  maxLength={40}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pub">Дата публикации</Label>
                <Input
                  id="pub"
                  type="datetime-local"
                  value={publishedAt}
                  onChange={(e) => setPublishedAt(e.target.value)}
                />
                <p className="text-xs text-neutral-500">
                  Пусто — текущие дата и время.
                </p>
              </div>
            </div>

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
                : "Добавить новость"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {list.length === 0 && (
        <p className="text-neutral-500 text-sm text-center py-8">
          Новостей пока нет. Добавь первую выше.
        </p>
      )}

      {/* На сайте — активные новости (на главной видно первые 6) */}
      {list.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Globe className="h-4 w-4 text-orange-500" />
            <h2 className="text-sm font-semibold text-white">На сайте</h2>
            <span className="text-xs text-neutral-500">
              {liveNews.length > HOMEPAGE_LIMIT
                ? `на главной видно ${HOMEPAGE_LIMIT} свежих · всего ${liveNews.length}`
                : `видно на главной · ${liveNews.length}`}
            </span>
          </div>
          {liveNews.length > 0 ? (
            <div className="space-y-3">{liveNews.map(renderCard)}</div>
          ) : (
            <p className="text-xs text-neutral-600">
              Все новости в архиве — на сайте сейчас ничего не показывается.
            </p>
          )}
        </div>
      )}

      {/* Архив — мягко удалённые: остаются в БД, но на сайте не видны */}
      {archivedNews.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowArchive((v) => !v)}
            className="flex w-full items-center gap-2 mb-3 text-left group"
          >
            <Archive className="h-4 w-4 text-neutral-400" />
            <h2 className="text-sm font-semibold text-white">Архив</h2>
            <span className="text-xs text-neutral-500">
              не на сайте · {archivedNews.length}
            </span>
            <ChevronDown
              className={[
                "h-4 w-4 text-neutral-500 ml-auto transition-transform",
                showArchive ? "rotate-180" : "",
              ].join(" ")}
            />
          </button>
          {showArchive ? (
            <div className="space-y-3">{archivedNews.map(renderCard)}</div>
          ) : (
            <p className="text-xs text-neutral-600">
              Свернуто. Нажми, чтобы показать архивные новости.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
