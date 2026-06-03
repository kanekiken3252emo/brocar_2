"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";
import { KeyRound, Mail, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const supabase = createClient();
      if (!supabase) {
        setError("Ошибка инициализации");
        return;
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          // Куда ведёт ссылка из письма. URL должен быть в списке разрешённых
          // в Supabase → Authentication → URL Configuration → Redirect URLs.
          redirectTo: `${window.location.origin}/auth/reset-password`,
        }
      );

      if (resetError) {
        setError(translateAuthError(resetError.message, resetError.code));
        return;
      }

      // Письмо отправлено (Supabase не сообщает, существует ли email —
      // это защита от перебора, поэтому показываем успех в любом случае).
      setSent(true);
    } catch (err) {
      setError("Не удалось отправить письмо — попробуйте ещё раз");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
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
          <p className="text-neutral-400">Восстановление доступа</p>
        </div>

        <Card className="border-neutral-800 bg-neutral-900/80 backdrop-blur-xl">
          {sent ? (
            <CardContent className="pt-6 text-center space-y-4">
              <div className="w-14 h-14 bg-green-500/15 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-7 w-7 text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Письмо отправлено</h2>
              <p className="text-neutral-400 text-sm leading-relaxed">
                Если аккаунт с адресом <span className="text-white">{email}</span> существует,
                мы отправили на него ссылку для сброса пароля. Проверьте почту
                (и папку «Спам»).
              </p>
              <Link href="/auth/login">
                <Button variant="outline" className="w-full gap-2 mt-2">
                  <ArrowLeft className="h-4 w-4" />
                  Вернуться ко входу
                </Button>
              </Link>
            </CardContent>
          ) : (
            <>
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-2xl flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                    <KeyRound className="h-5 w-5 text-orange-500" />
                  </div>
                  Забыли пароль?
                </CardTitle>
                <CardDescription className="text-neutral-400">
                  Введите email — пришлём ссылку для сброса пароля
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

                  <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                    {isLoading ? (
                      "Отправляем..."
                    ) : (
                      <>
                        Отправить ссылку
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>

                  <p className="text-center text-sm text-neutral-400">
                    Вспомнили пароль?{" "}
                    <Link
                      href="/auth/login"
                      className="text-orange-500 hover:text-orange-400 font-medium transition-colors"
                    >
                      Войти
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
