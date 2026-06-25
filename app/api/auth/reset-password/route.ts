import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  findValidToken,
  markTokenUsed,
  updateUserPassword,
  confirmUserEmail,
} from "@/lib/auth/users";
import { hashToken } from "@/lib/auth/tokens";
import { hashPassword } from "@/lib/auth/password";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(6),
});

export async function POST(request: NextRequest) {
  try {
    const { token, password } = schema.parse(await request.json());

    const row = await findValidToken(hashToken(token), "reset");
    if (!row) {
      return NextResponse.json(
        {
          error:
            "Ссылка недействительна или устарела. Запросите письмо для сброса заново.",
        },
        { status: 400 }
      );
    }

    await updateUserPassword(row.userId, await hashPassword(password));
    await markTokenUsed(row.id);
    // Раз человек получил письмо и сбросил пароль — почта точно его, подтверждаем.
    await confirmUserEmail(row.userId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Пароль должен содержать минимум 6 символов" },
        { status: 400 }
      );
    }
    console.error("Auth reset-password error:", e);
    return NextResponse.json(
      { error: "Ошибка сервера — попробуйте позже" },
      { status: 500 }
    );
  }
}
