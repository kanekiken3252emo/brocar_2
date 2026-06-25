import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findUserByEmail } from "@/lib/auth/users";
import { verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/cookies";
import { requireEmailConfirm } from "@/lib/auth/config";
import {
  loginRateKey,
  loginBlockedFor,
  recordLoginFailure,
  recordLoginSuccess,
} from "@/lib/auth/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Валидный bcrypt-хеш «впустую»: если email не найден, всё равно делаем compare,
// чтобы время ответа не выдавало, существует адрес или нет (защита от перебора).
const DUMMY_HASH =
  "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

function clientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = schema.parse(await request.json());
    const rateKey = loginRateKey(clientIp(request), email);

    // Анти-брутфорс: заблокированный ключ — сразу 429, пароль не проверяем.
    const blockedFor = loginBlockedFor(rateKey);
    if (blockedFor > 0) {
      return NextResponse.json(
        {
          error: `Слишком много попыток входа. Попробуйте через ${Math.ceil(
            blockedFor / 60
          )} мин.`,
        },
        { status: 429 }
      );
    }

    const user = await findUserByEmail(email);
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !ok) {
      recordLoginFailure(rateKey);
      return NextResponse.json(
        { error: "Неверный email или пароль" },
        { status: 401 }
      );
    }

    // Пароль верный → сбрасываем счётчик (даже если email ещё не подтверждён).
    recordLoginSuccess(rateKey);

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
