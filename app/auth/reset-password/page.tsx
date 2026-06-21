"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";
import { Lock, ArrowRight, CheckCircle2 } from "lucide-react";

export default function ResetPasswordPage() {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  // Клиент создаём только в браузере — на этой странице из URL автоматически
  // подхватывается сессия восстановления (?code=... из письма).
  useEffect(() => {
    setSupabase(createClient());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Пароль должен содержать минимум 6 символов");
      return;
    }
    if (password !== confirm) {
      setError("Пароли не совпадают");
      return;
    }
    if (!supabase) {
      setError("Ошибка инициализации — обновите страницу");
      return;
    }

    setIsLoading(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password });

      if (updErr) {
        const msg = (updErr.message ?? "").toLowerCase();
        if (msg.includes("session") || msg.includes("missing") || msg.includes("jwt")) {
          setError(
            "Ссылка недействительна или устарела. Запросите письмо для сброса заново."
          );
        } else {
          setError(translateAuthError(updErr.message, updErr.code));
        }
        return;
      }

      setDone(true);
      setTimeout(() => {
        router.push("/auth/login");
        router.refresh();
      }, 2500);
    } catch (err) {
      setError("Не удалось обновить пароль — попробуйте ещё раз");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-start sm:items-center justify-center p-4 py-8">
      {/* Background Decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-orange-600/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <div className="text-3xl font-bold text-white mb-2">BroCar</div>
          </Link>
          <p className="text-neutral-400">Новый пароль</p>
        </div>

        <Card className="border-neutral-800 bg-neutral-900/80 backdrop-blur-xl">
          {done ? (
            <CardContent className="pt-6 text-center space-y-4">
              <div className="w-14 h-14 bg-green-500/15 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-7 w-7 text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Пароль изменён</h2>
              <p className="text-neutral-400 text-sm">
                Сейчас перенаправим вас на страницу входа…
              </p>
            </CardContent>
          ) : (
            <>
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-2xl flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                    <Lock className="h-5 w-5 text-orange-500" />
                  </div>
                  Придумайте новый пароль
                </CardTitle>
                <CardDescription className="text-neutral-400">
                  Минимум 6 символов
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-sm">
                      {error}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="password">Новый пароль</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-500" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm">Повторите пароль</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-500" />
                      <Input
                        id="confirm"
                        type="password"
                        placeholder="••••••••"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                        disabled={isLoading}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                    {isLoading ? (
                      "Сохраняем..."
                    ) : (
                      <>
                        Сохранить пароль
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>

                  <p className="text-center text-sm text-neutral-400">
                    <Link
                      href="/auth/login"
                      className="text-orange-500 hover:text-orange-400 font-medium transition-colors"
                    >
                      Вернуться ко входу
                    </Link>
                  </p>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
