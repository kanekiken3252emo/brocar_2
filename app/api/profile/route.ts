import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/profile - Получить профиль текущего пользователя
 * Требует JWT авторизацию
 */
export const GET = withAuth(async (request, { user }) => {
  try {
    const supabase = await createClient();

    // Получаем профиль пользователя из БД
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      // Если профиля нет, создаём его
      if (error.code === "PGRST116") {
        const { data: newProfile, error: createError } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            email: user.email,
          })
          .select()
          .single();

        if (createError) {
          return NextResponse.json(
            { error: "Failed to create profile" },
            { status: 500 }
          );
        }

        return NextResponse.json({ profile: newProfile });
      }

      return NextResponse.json(
        { error: "Failed to fetch profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});

/**
 * PATCH /api/profile - Обновить профиль пользователя
 * Требует JWT авторизацию
 */
export const PATCH = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const { full_name, phone, avatar_url } = body;

    const supabase = await createClient();

    // Обновляем только разрешенные поля
    const updates: any = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (phone !== undefined) updates.phone = phone;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;

    const { data: profile, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Profile update error:", error);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});

