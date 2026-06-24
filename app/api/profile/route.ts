import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { toProfileResponse } from "@/lib/db/serialize";

/**
 * GET /api/profile — профиль текущего пользователя.
 * Читаем через drizzle (наша БД), а НЕ через supabase.from (PostgREST) — иначе
 * после переезда БД на VK ходили бы в старый Supabase. Если профиля нет —
 * создаём лениво (заменяет триггер handle_new_user, которого на VK нет).
 * Авторизация остаётся на Supabase; identity берём из JWT (user).
 */
export const GET = withAuth(async (_request, { user }) => {
  try {
    let [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    if (!profile) {
      // Ленивое создание (заменяет триггер handle_new_user, которого на VK нет).
      // email — NOT NULL UNIQUE: для юзера без email кладём уникальный плейсхолдер
      // (а не "", который у второго безымейлового нарушил бы UNIQUE). target:id —
      // гасим только гонку двух параллельных GET, не маскируя конфликт по email.
      const [created] = await db
        .insert(profiles)
        .values({ id: user.id, email: user.email ?? `${user.id}@noemail.local` })
        .onConflictDoNothing({ target: profiles.id })
        .returning();
      profile =
        created ??
        (await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1))[0];
    }

    if (!profile) {
      return NextResponse.json(
        { error: "Failed to create profile" },
        { status: 500 }
      );
    }
    return NextResponse.json({ profile: toProfileResponse(profile) });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

/**
 * PATCH /api/profile — обновить профиль (drizzle → наша БД).
 */
export const PATCH = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const {
      full_name,
      phone,
      avatar_url,
      contact_email,
      telegram,
      whatsapp,
      vk,
      max_messenger,
    } = body;

    // Только разрешённые поля; вход snake_case (от фронта) → camelCase (drizzle).
    const updates: Partial<typeof profiles.$inferInsert> = {};
    if (full_name !== undefined) updates.fullName = full_name;
    if (phone !== undefined) updates.phone = phone;
    if (avatar_url !== undefined) updates.avatarUrl = avatar_url;
    if (contact_email !== undefined) updates.contactEmail = contact_email;
    if (telegram !== undefined) updates.telegram = telegram;
    if (whatsapp !== undefined) updates.whatsapp = whatsapp;
    if (vk !== undefined) updates.vk = vk;
    if (max_messenger !== undefined) updates.maxMessenger = max_messenger;
    updates.updatedAt = new Date();

    const [profile] = await db
      .update(profiles)
      .set(updates)
      .where(eq(profiles.id, user.id))
      .returning();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    return NextResponse.json({ profile: toProfileResponse(profile) });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
