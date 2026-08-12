"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { categoryCatalogUrl } from "@/lib/catalog/urls";
import {
  Car,
  Plus,
  Trash2,
  Search,
  Gauge,
  Loader2,
  Wrench,
  Package,
  ChevronRight,
  Sparkles,
} from "lucide-react";

export interface GarageVehicle {
  id: number;
  nickname: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  vin: string | null;
  mileage: number | null;
}

export interface PurchasedPart {
  name: string;
  article: string;
  brand: string | null;
  date: string;
}

/** Рекомендации по обслуживанию — ведут в каталог по категории. */
const MAINTENANCE = [
  { title: "Моторное масло", hint: "каждые 10 000 км", category: "engine-oils" },
  { title: "Воздушный фильтр", hint: "каждые 15 000 км", category: "air-filters" },
  { title: "Тормозные колодки", hint: "каждые 30 000 км", category: "brake-pads" },
  { title: "Антифриз", hint: "каждые 40 000 км", category: "coolants" },
  { title: "Тормозная жидкость", hint: "раз в 2 года", category: "brake-fluids" },
  { title: "Щётки стеклоочистителя", hint: "раз в год", category: "wipers" },
  { title: "Лампы и фары", hint: "по мере перегорания", category: "lamps" },
  { title: "Аккумулятор", hint: "раз в 3–5 лет", category: "batteries" },
];

function vehicleTitle(v: GarageVehicle): string {
  const parts = [v.brand, v.model].filter(Boolean).join(" ");
  if (v.nickname) return v.nickname;
  if (parts) return parts + (v.year ? `, ${v.year}` : "");
  return v.vin ? `VIN ${v.vin}` : "Автомобиль";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function GarageClient({
  initialVehicles,
  purchased,
  isAuthenticated,
}: {
  initialVehicles: GarageVehicle[];
  purchased: PurchasedPart[];
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<GarageVehicle[]>(initialVehicles);
  const [showForm, setShowForm] = useState(false);

  // Лимит машин в гараже (синхронно с сервером — app/api/garage/route.ts).
  const MAX_VEHICLES = 3;
  const atLimit = vehicles.length >= MAX_VEHICLES;

  // Гость не может добавлять — отправляем на регистрацию.
  function handleAddClick() {
    if (!isAuthenticated) {
      router.push("/auth/register");
      return;
    }
    if (atLimit) return;
    setShowForm(true);
  }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    nickname: "",
    brand: "",
    model: "",
    year: "",
    vin: "",
    mileage: "",
  });

  // Автозаполнение марки/модели/года по VIN из каталога Laximo.
  const [vinLoading, setVinLoading] = useState(false);
  const [vinMsg, setVinMsg] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  async function lookupVin() {
    const vin = form.vin.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (vin.length !== 17) {
      setVinMsg({ ok: false, text: "VIN должен состоять из 17 символов" });
      return;
    }
    setVinLoading(true);
    setVinMsg(null);
    try {
      const res = await fetch(
        `/api/goodvin/car-info?q=${encodeURIComponent(vin)}`
      );
      const data = await res.json();
      if (!res.ok || !data.cars?.length) {
        throw new Error(data?.error || "По этому VIN автомобиль не найден");
      }
      const c = data.cars[0];
      // Год: сперва параметр «Выпущено» (manufactured), иначе — из даты выпуска.
      const params: Array<{ key: string; value: string }> = c.parameters || [];
      const man = params.find((p) => p.key === "manufactured")?.value;
      const date = params.find((p) => p.key === "date")?.value;
      const year =
        (man && man.match(/\d{4}/)?.[0]) ||
        (date && date.match(/\d{4}/)?.[0]) ||
        "";
      setForm((f) => ({
        ...f,
        vin,
        brand: c.brand || f.brand,
        model: c.modelName || f.model,
        year: year || f.year,
      }));
      setVinMsg({
        ok: true,
        text: `Нашли: ${[c.brand, c.modelName].filter(Boolean).join(" ")}`,
      });
    } catch (e) {
      setVinMsg({
        ok: false,
        text: e instanceof Error ? e.message : "Не удалось определить авто",
      });
    } finally {
      setVinLoading(false);
    }
  }

  async function addVehicle(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/garage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Не удалось сохранить");
      setVehicles((prev) => [data.vehicle, ...prev]);
      setForm({ nickname: "", brand: "", model: "", year: "", vin: "", mileage: "" });
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  async function removeVehicle(id: number) {
    if (!confirm("Удалить машину из гаража?")) return;
    const res = await fetch(`/api/garage/${id}`, { method: "DELETE" });
    if (res.ok) setVehicles((prev) => prev.filter((v) => v.id !== id));
    else alert("Не удалось удалить");
  }

  async function updateMileage(v: GarageVehicle) {
    const input = prompt("Текущий пробег, км:", v.mileage ? String(v.mileage) : "");
    if (input === null) return;
    const mileage = input.replace(/\D/g, "");
    const res = await fetch(`/api/garage/${v.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mileage }),
    });
    if (res.ok) {
      const data = await res.json();
      setVehicles((prev) => prev.map((x) => (x.id === v.id ? data.vehicle : x)));
    } else alert("Не удалось обновить пробег");
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Заголовок */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-orange-500/20 rounded-xl flex items-center justify-center">
                <Car className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">Мой гараж</h1>
                <p className="text-neutral-400 text-sm">
                  {vehicles.length
                    ? `Машин в гараже: ${vehicles.length} из ${MAX_VEHICLES}`
                    : "Добавьте первый автомобиль"}
                </p>
              </div>
            </div>
            {!showForm && vehicles.length > 0 && !atLimit && (
              <Button onClick={handleAddClick} className="gap-2 shrink-0">
                <Plus className="h-4 w-4" />
                Добавить
              </Button>
            )}
            {!showForm && atLimit && (
              <p className="text-neutral-500 text-sm shrink-0 max-w-[10rem] text-right">
                Достигнут лимит {MAX_VEHICLES} машин
              </p>
            )}
          </div>

          {/* Форма добавления */}
          {showForm && (
            <Card className="border-neutral-800 bg-neutral-900">
              <CardContent className="p-5 md:p-6">
                <form onSubmit={addVehicle} className="space-y-4">
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm">
                      {error}
                    </div>
                  )}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="brand">Марка</Label>
                      <Input id="brand" placeholder="Toyota" value={form.brand} maxLength={40}
                        onChange={(e) => setForm({ ...form, brand: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="model">Модель</Label>
                      <Input id="model" placeholder="Camry" value={form.model} maxLength={40}
                        onChange={(e) => setForm({ ...form, model: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="year">Год выпуска</Label>
                      <Input id="year" inputMode="numeric" placeholder="2018" value={form.year}
                        onChange={(e) => setForm({ ...form, year: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="mileage">Пробег, км</Label>
                      <Input id="mileage" inputMode="numeric" placeholder="120000" value={form.mileage}
                        onChange={(e) => setForm({ ...form, mileage: e.target.value.replace(/\D/g, "").slice(0, 7) })} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="vin">VIN / номер кузова</Label>
                      <div className="flex gap-2">
                        <Input id="vin" placeholder="XTA210990Y2741911" value={form.vin} maxLength={17}
                          className="flex-1 font-mono uppercase"
                          onChange={(e) => { setForm({ ...form, vin: e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 17) }); setVinMsg(null); }} />
                        <Button type="button" variant="outline" onClick={lookupVin}
                          disabled={vinLoading} className="gap-2 shrink-0">
                          {vinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                          Подтянуть
                        </Button>
                      </div>
                      {vinMsg ? (
                        <p className={`text-xs ${vinMsg.ok ? "text-green-400" : "text-amber-400"}`}>
                          {vinMsg.text}
                        </p>
                      ) : (
                        <p className="text-xs text-neutral-500">
                          VIN — 17 символов ({form.vin.length}/17). Введите и нажмите «Подтянуть» — марка, модель и год заполнятся сами.
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="nickname">Название (по желанию)</Label>
                      <Input id="nickname" placeholder="Моя Камри" value={form.nickname} maxLength={60}
                        onChange={(e) => setForm({ ...form, nickname: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={saving} className="gap-2">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Сохранить
                    </Button>
                    {vehicles.length > 0 && (
                      <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                        Отмена
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Состояние 2: вошёл, но машины нет */}
          {vehicles.length === 0 && !showForm && (
            <Card className="border-neutral-800 bg-neutral-900">
              <CardContent className="py-12 px-6 text-center">
                <div className="w-14 h-14 mx-auto mb-4 bg-orange-500/15 rounded-2xl flex items-center justify-center">
                  <Car className="h-7 w-7 text-orange-500" />
                </div>
                <p className="text-white font-semibold text-lg mb-1">
                  В гараже пока пусто
                </p>
                <p className="text-neutral-400 text-sm mb-5 max-w-sm mx-auto">
                  Добавьте автомобиль с VIN — и сможете искать запчасти по нему в
                  один клик, а мы подскажем, что пора обновить.
                </p>
                <Button onClick={handleAddClick} size="lg" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Добавить автомобиль
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Список машин */}
          {vehicles.length > 0 && (
            <div className="grid md:grid-cols-2 gap-4">
              {vehicles.map((v) => (
                <Card key={v.id} className="border-neutral-800 bg-neutral-900">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-white font-bold text-lg truncate">{vehicleTitle(v)}</p>
                        {(v.brand || v.model) && v.nickname && (
                          <p className="text-neutral-500 text-sm truncate">
                            {[v.brand, v.model, v.year].filter(Boolean).join(" ")}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => removeVehicle(v.id)}
                        className="text-neutral-600 hover:text-red-400 transition-colors shrink-0"
                        title="Удалить"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-1.5 text-sm">
                      {v.vin && (
                        <div className="flex items-center gap-2 text-neutral-300">
                          <span className="text-neutral-500 w-16 shrink-0">VIN</span>
                          <span className="font-mono truncate">{v.vin}</span>
                        </div>
                      )}
                      <button
                        onClick={() => updateMileage(v)}
                        className="flex items-center gap-2 text-neutral-300 hover:text-orange-400 transition-colors"
                      >
                        <Gauge className="h-3.5 w-3.5 text-neutral-500" />
                        {v.mileage ? `${v.mileage.toLocaleString("ru-RU")} км` : "Указать пробег"}
                      </button>
                    </div>

                    {v.vin ? (
                      <Link href={`/catalog-vin?vin=${encodeURIComponent(v.vin)}`}>
                        <Button className="w-full gap-2">
                          <Search className="h-4 w-4" />
                          Искать запчасти по VIN
                        </Button>
                      </Link>
                    ) : (
                      <Link href="/catalog-vin">
                        <Button variant="outline" className="w-full gap-2">
                          <Search className="h-4 w-4" />
                          Подобрать по марке
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Рекомендации по обслуживанию */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-orange-500/20 rounded-xl flex items-center justify-center shrink-0">
                <Wrench className="h-4 w-4 text-orange-500" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-white">Пора обновить?</h2>
                <p className="text-neutral-500 text-sm">Расходники, которые стоит проверить</p>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {MAINTENANCE.map((m) => (
                <Link key={m.category} href={categoryCatalogUrl(m.category)} className="group">
                  <div className="h-full bg-neutral-900 border border-neutral-800 hover:border-orange-500/50 transition-colors rounded-xl p-4 flex flex-col">
                    <p className="font-semibold text-white text-sm mb-1">{m.title}</p>
                    <p className="text-neutral-500 text-xs mb-3">{m.hint}</p>
                    <span className="mt-auto inline-flex items-center gap-1 text-orange-500 text-xs font-medium">
                      Подобрать
                      <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* История покупок */}
          {purchased.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-orange-500/20 rounded-xl flex items-center justify-center shrink-0">
                  <Package className="h-4 w-4 text-orange-500" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">Вы уже покупали</h2>
                  <p className="text-neutral-500 text-sm">Детали из ваших заказов</p>
                </div>
              </div>
              <Card className="border-neutral-800 bg-neutral-900">
                <CardContent className="p-0 divide-y divide-neutral-800">
                  {purchased.map((p, i) => (
                    <Link
                      key={`${p.article}-${i}`}
                      href={`/catalog?article=${encodeURIComponent(p.article)}`}
                      className="flex items-center justify-between gap-4 p-4 hover:bg-neutral-800/40 transition-colors group"
                    >
                      <div className="min-w-0">
                        <p className="text-white text-sm truncate group-hover:text-orange-400 transition-colors">
                          {p.name}
                        </p>
                        <p className="text-neutral-500 font-mono text-xs">
                          {p.article}
                          {p.brand ? ` · ${p.brand}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-neutral-600 text-xs hidden sm:block">
                          {formatDate(p.date)}
                        </span>
                        <ChevronRight className="h-4 w-4 text-neutral-600 group-hover:text-orange-500 transition-colors" />
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
