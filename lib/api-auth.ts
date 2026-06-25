import { createClient } from "@/lib/supabase/server";
import { isLocalAuth } from "@/lib/auth/config";
import { readSessionUser } from "@/lib/auth/cookies";
import { NextRequest, NextResponse } from "next/server";

/**
 * Текущий пользователь для API: в local-режиме — наша cookie (JWT), в
 * supabase-режиме — Supabase. Возвращает { id, email } или null.
 */
async function currentApiUser(): Promise<{ id: string; email: string } | null> {
  if (isLocalAuth()) {
    return readSessionUser();
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id, email: user.email ?? "" } : null;
}

/**
 * Middleware для проверки авторизации в API routes.
 * Блокирует запрос 401-й, если пользователь не определён.
 */
export function withAuth(
  handler: (
    request: NextRequest,
    context: { user: any; params?: any }
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any) => {
    try {
      const user = await currentApiUser();

      if (!user) {
        return NextResponse.json(
          { error: "Unauthorized - Invalid or missing session" },
          { status: 401 }
        );
      }

      return handler(request, { user, params: await context?.params });
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
 * Опциональная авторизация - не блокирует запрос, если пользователя нет.
 * Используется для API, которые могут работать как с авторизацией, так и без.
 */
export function withOptionalAuth(
  handler: (
    request: NextRequest,
    context: { user: any | null; params?: any }
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any) => {
    try {
      const user = await currentApiUser();
      return handler(request, { user, params: await context?.params });
    } catch (error) {
      console.error("Optional auth middleware error:", error);
      return handler(request, { user: null, params: await context?.params });
    }
  };
}

/**
 * Получить ID пользователя.
 */
export async function getUserId(): Promise<string | null> {
  try {
    const user = await currentApiUser();
    return user?.id || null;
  } catch (error) {
    console.error("Get user ID error:", error);
    return null;
  }
}

/**
 * Проверить, авторизован ли пользователь.
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const user = await currentApiUser();
    return !!user;
  } catch (error) {
    return false;
  }
}
