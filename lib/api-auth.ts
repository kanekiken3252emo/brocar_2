import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware для проверки JWT токена в API routes
 * Использует Supabase Auth для валидации токена
 */
export function withAuth(
  handler: (
    request: NextRequest,
    context: { user: any; params?: any }
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any) => {
    try {
      const supabase = await createClient();

      // Получаем пользователя из JWT токена (автоматически из cookies)
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        return NextResponse.json(
          { error: "Unauthorized - Invalid or missing JWT token" },
          { status: 401 }
        );
      }

      // Вызываем оригинальный handler с данными пользователя
      return handler(request, { user, params: context?.params });
    } catch (error) {
      console.error("Auth middleware error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}

/**
 * Опциональная авторизация - не блокирует запрос, если токена нет
 * Используется для API, которые могут работать как с авторизацией, так и без
 */
export function withOptionalAuth(
  handler: (
    request: NextRequest,
    context: { user: any | null; params?: any }
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any) => {
    try {
      const supabase = await createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Вызываем handler с user или null
      return handler(request, { user: user || null, params: context?.params });
    } catch (error) {
      console.error("Optional auth middleware error:", error);
      // В случае ошибки просто передаём null
      return handler(request, { user: null, params: context?.params });
    }
  };
}

/**
 * Получить ID пользователя из JWT токена
 * Полезная утилита для быстрого получения user_id
 */
export async function getUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id || null;
  } catch (error) {
    console.error("Get user ID error:", error);
    return null;
  }
}

/**
 * Проверить, авторизован ли пользователь
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return !!user;
  } catch (error) {
    return false;
  }
}

