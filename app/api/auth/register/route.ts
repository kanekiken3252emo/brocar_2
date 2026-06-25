import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { createUser, createAuthToken, normalizeEmail } from "@/lib/auth/users";
import { hashPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/cookies";
import { requireEmailConfirm } from "@/lib/auth/config";
import { generateToken, hashToken, CONFIRM_TTL_MS } from "@/lib/auth/tokens";
import { sendEmailConfirmation } from "@/lib/email";
import { publicBaseUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: NextRequest) {
  try {
    const { email, password } = schema.parse(await request.json());

    const passwordHash = await hashPassword(password);
    // По умолчанию требуем подтверждение email перед входом (как было на Supabase).
    // Отключается через AUTH_REQUIRE_EMAIL_CONFIRM=false.
    const requireConfirm = requireEmailConfirm();

    const user = await createUser({
      email,
      passwordHash,
      emailConfirmedAt: requireConfirm ? null : new Date(),
    });

    if (!user) {
      return NextResponse.json(
        { error: "Аккаунт с таким email уже существует" },
        { status: 409 }
      );
    }

    // Профиль для личного кабинета (email там и показывается). Не критично:
    // если не получилось (напр. редкий конфликт по email), профиль создастся
    // лениво при первом заходе в /api/profile — поэтому сбой не валит регистрацию.
    try {
      await db
        .insert(profiles)
        .values({ id: user.id, email: normalizeEmail(email) })
        .onConflictDoNothing({ target: profiles.id });
    } catch (profileErr) {
      console.error("Register: profile create skipped:", profileErr);
    }

    if (!requireConfirm) {
      await setSessionCookie({ id: user.id, email: user.email });
      return NextResponse.json({ ok: true, session: true });
    }

    // Требуется подтверждение: создаём токен и шлём письмо со ссылкой. Сбой SMTP
    // не валит регистрацию (аккаунт создан, письмо можно перезапросить) — логируем.
    const token = generateToken();
    await createAuthToken({
      userId: user.id,
      type: "confirm",
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + CONFIRM_TTL_MS),
    });
    const confirmUrl = `${publicBaseUrl(request)}/auth/confirm?token=${token}`;
    try {
      await sendEmailConfirmation(user.email, confirmUrl);
    } catch (mailErr) {
      console.error("Confirmation email failed:", mailErr);
    }

    return NextResponse.json({ ok: true, session: false });
  } catch (e) {
    if (e instanceof z.ZodError) {
      const tooShort = e.errors.some((x) => x.path[0] === "password");
      return NextResponse.json(
        {
          error: tooShort
            ? "Пароль должен содержать минимум 6 символов"
            : "Неверный формат email",
        },
        { status: 400 }
      );
    }
    console.error("Auth register error:", e);
    return NextResponse.json(
      { error: "Ошибка сервера — попробуйте позже" },
      { status: 500 }
    );
  }
}
