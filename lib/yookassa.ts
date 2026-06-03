import { randomUUID } from "crypto";

/**
 * Минимальный клиент API ЮKassa (v3).
 * Docs: https://yookassa.ru/developers/api
 *
 * Авторизация — HTTP Basic: shopId:secretKey.
 * Все суммы передаются строкой с двумя знаками после запятой ("1990.00").
 */

const API_BASE = "https://api.yookassa.ru/v3";

function authHeader(): string {
  const shopId = process.env.PAYMENT_SHOP_ID;
  const secretKey = process.env.PAYMENT_SECRET_KEY;
  if (!shopId || !secretKey) {
    throw new Error(
      "ЮKassa не настроена: задайте PAYMENT_SHOP_ID и PAYMENT_SECRET_KEY в окружении"
    );
  }
  const token = Buffer.from(`${shopId}:${secretKey}`).toString("base64");
  return `Basic ${token}`;
}

/** Сумма в рублях → строка "1990.00", как требует API. */
export function toAmountValue(rub: number): string {
  return rub.toFixed(2);
}

// ─── Receipt (54-ФЗ) ──────────────────────────────────────────────────────────

export interface ReceiptItem {
  description: string; // наименование товара (макс. 128 символов)
  quantity: string; // "1.00"
  amount: { value: string; currency: "RUB" };
  vat_code: number; // ставка НДС (см. ЛК ЮKassa). 1 = без НДС
  // Обязательны при включённой фискализации («Чеки от ЮKassa»):
  payment_subject: string; // предмет расчёта: "commodity" = товар
  payment_mode: string; // способ расчёта: "full_payment" = полный расчёт
}

export interface Receipt {
  customer: { email?: string; phone?: string };
  items: ReceiptItem[];
  tax_system_code?: number; // система налогообложения (1 = ОСН, 2 = УСН доход, ...)
}

// ─── Payment ────────────────────────────────────────────────────────────────

export interface YooKassaPayment {
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  paid: boolean;
  amount: { value: string; currency: string };
  confirmation?: {
    type: string;
    confirmation_url?: string;
  };
  metadata?: Record<string, string>;
}

export interface CreatePaymentParams {
  amount: number; // в рублях
  description: string;
  returnUrl: string;
  metadata: Record<string, string>;
  receipt?: Receipt;
}

/**
 * Создаёт платёж. Возвращает объект платежа с confirmation_url для редиректа.
 * Одностадийный платёж (capture: true) — деньги списываются сразу.
 */
export async function createPayment(
  params: CreatePaymentParams
): Promise<YooKassaPayment> {
  const body: Record<string, unknown> = {
    amount: {
      value: toAmountValue(params.amount),
      currency: "RUB",
    },
    capture: true,
    confirmation: {
      type: "redirect",
      return_url: params.returnUrl,
    },
    description: params.description,
    metadata: params.metadata,
  };

  if (params.receipt) {
    body.receipt = params.receipt;
  }

  const res = await fetch(`${API_BASE}/payments`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      // Ключ идемпотентности: защищает от двойного списания при ретраях.
      "Idempotence-Key": randomUUID(),
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      `ЮKassa createPayment failed (${res.status}): ${JSON.stringify(data)}`
    );
  }

  return data as YooKassaPayment;
}

/**
 * Запрашивает платёж по id. Используется в вебхуке для проверки подлинности
 * уведомления — мы не доверяем телу запроса, а сверяем статус напрямую с API.
 */
export async function getPayment(paymentId: string): Promise<YooKassaPayment> {
  const res = await fetch(`${API_BASE}/payments/${paymentId}`, {
    method: "GET",
    headers: {
      Authorization: authHeader(),
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      `ЮKassa getPayment failed (${res.status}): ${JSON.stringify(data)}`
    );
  }

  return data as YooKassaPayment;
}
