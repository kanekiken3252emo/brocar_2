import { NextRequest, NextResponse } from "next/server";
import { sendVinRequestNotification } from "@/lib/email";

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i;

/**
 * Заявка на подбор запчасти по VIN (форма /vin-search).
 * Шлёт письмо менеджеру на ORDER_NOTIFICATION_EMAIL (info@brocarparts.ru).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const vin = String(body?.vin ?? "").trim().toUpperCase();
    const phone = String(body?.phone ?? "").trim();
    const comment = String(body?.comment ?? "").trim();

    if (!VIN_REGEX.test(vin)) {
      return NextResponse.json(
        { error: "Некорректный VIN (нужно 17 символов)" },
        { status: 400 }
      );
    }
    if (!phone) {
      return NextResponse.json(
        { error: "Укажите номер телефона" },
        { status: 400 }
      );
    }

    await sendVinRequestNotification({
      vin,
      phone,
      comment: comment || null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("VIN request error:", (error as Error).message);
    return NextResponse.json(
      { error: "Не удалось отправить заявку. Попробуйте позже или позвоните нам." },
      { status: 500 }
    );
  }
}
