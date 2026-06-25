import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findUserByEmail } from "@/lib/auth/users";
import { verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/cookies";
import { requireEmailConfirm } from "@/lib/auth/config";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Валидный bcrypt-хеш «впустую»: если email не найден, всё равно делаем compare,
// чтобы время ответа не выдавало, существует адрес или нет (защита от перебора).
const DUMMY_HASH =
  "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = schema.parse(await request.json());

    const user = await findUserByEmail(email);
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !ok) {
      return NextResponse.json(
        { error: "Неверный email или пароль" },
        { status: 401 }
      );
    }

    if (requireEmailConfirm() && !user.emailConfirmedAt) {
      return NextResponse.json(
        {
          error:
            "Email не подтверждён — проверьте почту и перейдите по ссылке в письме",
        },
        { status: 403 }
      );
    }

    await setSessionCookie({ id: user.id, email: user.email });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Введите корректный email и пароль" },
        { status: 400 }
      );
    }
    console.error("Auth login error:", e);
    return NextResponse.json(
      { error: "Ошибка сервера — попробуйте позже" },
      { status: 500 }
    );
  }
}
