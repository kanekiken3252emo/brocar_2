import { NextRequest, NextResponse } from "next/server";
import { sendPartRequestNotification } from "@/lib/email";

/**
 * Заявка с формы «Не нашли запчасть?» в конце главной.
 * Шлёт письмо менеджеру на ORDER_NOTIFICATION_EMAIL (info@brocarparts.ru).
 * Обязательны имя и телефон; текст запроса — по желанию.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = String(body?.name ?? "").trim();
    const phone = String(body?.phone ?? "").trim();
    const query = String(body?.query ?? "").trim();

    if (!name) {
      return NextResponse.json({ error: "Укажите имя" }, { status: 400 });
    }
    // Минимальная проверка телефона: хотя бы 6 цифр (без привязки к формату).
    if ((phone.match(/\d/g) ?? []).length < 6) {
      return NextResponse.json(
        { error: "Укажите корректный номер телефона" },
        { status: 400 }
      );
    }

    await sendPartRequestNotification({
      // Ограничиваем длину, чтобы не принимать «простыни» в письмо.
      name: name.slice(0, 200),
      phone: phone.slice(0, 50),
      query: query ? query.slice(0, 2000) : null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Part request error:", (error as Error).message);
    return NextResponse.json(
      {
        error:
          "Не удалось отправить заявку. Попробуйте позже или позвоните нам.",
      },
      { status: 500 }
    );
  }
}
