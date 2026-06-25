import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findUserByEmail, createAuthToken } from "@/lib/auth/users";
import { generateToken, hashToken, TOKEN_TTL_MS } from "@/lib/auth/tokens";
import { sendPasswordResetEmail } from "@/lib/email";
import { publicBaseUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().email() });

export async function POST(request: NextRequest) {
  try {
    const { email } = schema.parse(await request.json());

    const user = await findUserByEmail(email);

    // Письмо отправляем только если аккаунт есть, но ОТВЕТ всегда одинаковый
    // (не сообщаем, существует ли адрес — защита от перебора).
    if (user) {
      const token = generateToken();
      await createAuthToken({
        userId: user.id,
        type: "reset",
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      });

      const resetUrl = `${publicBaseUrl(request)}/auth/reset-password?token=${token}`;
      try {
        await sendPasswordResetEmail(user.email, resetUrl);
      } catch (mailErr) {
        // Сбой SMTP не должен раскрывать существование адреса и не валит ответ.
        console.error("Password reset email failed:", mailErr);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Введите корректный email" },
        { status: 400 }
      );
    }
    console.error("Auth forgot-password error:", e);
    return NextResponse.json(
      { error: "Ошибка сервера — попробуйте позже" },
      { status: 500 }
    );
  }
}
