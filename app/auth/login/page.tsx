"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { signIn } from "@/lib/auth/client-actions";
import { LogIn, Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const { error: signInError } = await signIn(email, password);

      if (signInError) {
        setError(signInError);
        setIsLoading(false);
        return;
      }

      // Полная навигация (не router.push): сервер увидит свежие куки сессии и
      // сразу отрисует личный кабинет. push+refresh иногда оставлял на логине.
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("redirect") || "/dashboard";
      const redirectTo =
        raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
      window.location.assign(redirectTo);
    } catch (err) {
      setError("Произошла ошибка при входе");
      console.error(err);
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
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <div className="text-3xl font-bold text-white mb-2">BroCar</div>
          </Link>
          <p className="text-neutral-400">Войдите в свой аккаунт</p>
        </div>
        
        <Card className="border-neutral-800 bg-neutral-900/80 backdrop-blur-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                <LogIn className="h-5 w-5 text-orange-500" />
              </div>
              Вход в систему
            </CardTitle>
            <CardDescription className="text-neutral-400">
              Введите данные для входа в личный кабинет
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
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Пароль</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-xs text-orange-500 hover:text-orange-400 font-medium transition-colors"
                  >
                    Забыли пароль?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-500" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
                    aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? (
                  "Вход..."
                ) : (
                  <>
                    Войти
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-800"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-neutral-900 px-2 text-neutral-500">или</span>
                </div>
              </div>

              <p className="text-center text-sm text-neutral-400">
                Нет аккаунта?{" "}
                <Link
                  href="/auth/register"
                  className="text-orange-500 hover:text-orange-400 font-medium transition-colors"
                >
                  Зарегистрироваться
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-neutral-600 mt-6">
          Продолжая, вы соглашаетесь с{" "}
          <Link href="/legal/terms" className="text-neutral-400 hover:text-orange-500 transition-colors">
            условиями использования
          </Link>
        </p>
      </div>
    </div>
  );
}
