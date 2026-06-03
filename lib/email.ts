import nodemailer from "nodemailer";

/**
 * Отправка почты через SMTP (почта домена на Beget).
 * Настройки берутся из переменных окружения:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD
 *   MAIL_FROM                — адрес отправителя (должен совпадать с ящиком)
 *   ORDER_NOTIFICATION_EMAIL — куда слать уведомления о заказах
 */

export interface OrderEmailItem {
  name: string;
  article: string;
  brand: string | null;
  qty: number;
  price: string; // цена за единицу
}

export interface OrderEmailData {
  orderId: number;
  total: number;
  customerEmail: string;
  customerName?: string | null;
  customerPhone?: string | null;
  contactEmail?: string | null;
  telegram?: string | null;
  whatsapp?: string | null;
  vk?: string | null;
  maxMessenger?: string | null;
  items: OrderEmailItem[];
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const port = parseInt(process.env.SMTP_PORT || "465", 10);

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 — SSL; 587/2525 — STARTTLS
    auth: { user, pass },
  });
}

/** Экранирование пользовательских данных перед вставкой в HTML. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatRub(n: number): string {
  return n.toLocaleString("ru-RU") + " ₽";
}

/**
 * Шлёт магазину письмо о новом заказе. Бросает ошибку при сбое —
 * вызывающий код должен сам решить, критично это или нет.
 */
export async function sendOrderNotification(data: OrderEmailData): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("SMTP не настроен — уведомление о заказе не отправлено");
    return;
  }

  const to = process.env.ORDER_NOTIFICATION_EMAIL || process.env.SMTP_USER!;
  const from = process.env.MAIL_FROM || process.env.SMTP_USER!;

  const rows = data.items
    .map(
      (i) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee">${esc(i.name)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-family:monospace">${esc(i.article)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${esc(i.brand ?? "—")}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.qty}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatRub(parseFloat(i.price))}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatRub(parseFloat(i.price) * i.qty)}</td>
      </tr>`
    )
    .join("");

  // Мессенджеры для связи — показываем только заполненные
  const messengers: string[] = [];
  if (data.telegram) messengers.push(`Telegram: ${esc(data.telegram)}`);
  if (data.whatsapp) messengers.push(`WhatsApp: ${esc(data.whatsapp)}`);
  if (data.maxMessenger) messengers.push(`MAX: ${esc(data.maxMessenger)}`);
  if (data.vk) messengers.push(`ВКонтакте: ${esc(data.vk)}`);
  const messengersHtml = messengers.length
    ? `<p style="margin:4px 0"><b>Мессенджеры:</b> ${messengers.join(" · ")}</p>`
    : "";

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#222">
    <h2 style="color:#ea580c">Новый заказ №${data.orderId}</h2>
    <p style="margin:4px 0"><b>Сумма:</b> ${formatRub(data.total)}</p>
    <p style="margin:4px 0"><b>Покупатель:</b> ${esc(data.customerName ?? "—")}</p>
    <p style="margin:4px 0"><b>Телефон:</b> ${esc(data.customerPhone ?? "—")}</p>
    <p style="margin:4px 0"><b>Почта для связи:</b> ${esc(data.contactEmail || data.customerEmail)}</p>
    <p style="margin:4px 0"><b>Email аккаунта:</b> ${esc(data.customerEmail)}</p>
    ${messengersHtml}

    <table style="border-collapse:collapse;width:100%;margin-top:16px;font-size:14px">
      <thead>
        <tr style="background:#f5f5f5;text-align:left">
          <th style="padding:8px">Наименование</th>
          <th style="padding:8px">Артикул</th>
          <th style="padding:8px">Бренд</th>
          <th style="padding:8px;text-align:center">Кол-во</th>
          <th style="padding:8px;text-align:right">Цена</th>
          <th style="padding:8px;text-align:right">Сумма</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <p style="margin-top:16px;font-size:18px"><b>Итого: ${formatRub(data.total)}</b></p>
  </div>`;

  await transporter.sendMail({
    from: `"BroCar — заказы" <${from}>`,
    to,
    replyTo: data.customerEmail,
    subject: `Новый заказ №${data.orderId} на ${formatRub(data.total)}`,
    html,
  });
}
