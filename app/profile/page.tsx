"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { User, Phone, Mail, Shield, ArrowLeft, CheckCircle, Save } from "lucide-react";
import Link from "next/link";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const supabase = createClient();
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/auth/login");
        return;
      }

      const response = await fetch("/api/profile");
      
      if (!response.ok) {
        throw new Error("Failed to load profile");
      }

      const data = await response.json();
      setProfile(data.profile);
      setFullName(data.profile.full_name || "");
      setPhone(data.profile.phone || "");
    } catch (err) {
      console.error("Profile load error:", err);
      setError("Не удалось загрузить профиль");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError("");
    setSuccess(false);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: fullName,
          phone: phone,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      const data = await response.json();
      setProfile(data.profile);
      setSuccess(true);
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Profile update error:", err);
      setError("Не удалось обновить профиль");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-400">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Header */}
          <div>
            <Link href="/dashboard" className="inline-flex items-center text-orange-500 hover:text-orange-400 mb-4 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Вернуться в личный кабинет
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Профиль</h1>
            <p className="text-neutral-400">
              Управление вашими личными данными
            </p>
          </div>

          {/* Profile Form */}
          <Card className="border-neutral-800 bg-neutral-900">
            <CardHeader className="border-b border-neutral-800">
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                  <User className="h-5 w-5 text-orange-500" />
                </div>
                Личная информация
              </CardTitle>
              <CardDescription className="text-neutral-400">
                Обновите свои контактные данные
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-sm">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="bg-green-500/10 border border-green-500/30 text-green-400 p-4 rounded-xl text-sm flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Профиль успешно обновлен!
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-500" />
                    <Input
                      id="email"
                      type="email"
                      value={profile?.email || ""}
                      disabled
                      className="pl-10 bg-neutral-800/50 text-neutral-400"
                    />
                  </div>
                  <p className="text-xs text-neutral-500">
                    Email нельзя изменить
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName">Полное имя</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-500" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Иван Иванов"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={isSaving}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Телефон</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-500" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+7 (900) 123-45-67"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={isSaving}
                      className="pl-10"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    "Сохранение..."
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Сохранить изменения
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Security Card */}
          <Card className="border-neutral-800 bg-neutral-900">
            <CardHeader className="border-b border-neutral-800">
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                  <Shield className="h-5 w-5 text-green-500" />
                </div>
                Безопасность
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-neutral-800/50 border border-neutral-700 rounded-xl">
                  <div>
                    <p className="font-medium text-white">JWT Токен</p>
                    <p className="text-sm text-neutral-500">
                      Ваша сессия защищена JWT токеном
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    Активен
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
