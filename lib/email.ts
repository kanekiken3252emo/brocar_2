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
  supplier?: string | null; // реальный поставщик/склад (только письмо магазину)
  deliveryDays?: number | null; // срок доставки, дней
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
        <td style="padding:8px;border-bottom:1px solid #eee">${esc(i.supplier ?? "—")}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.qty}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.deliveryDays != null ? esc(String(i.deliveryDays)) + " дн." : "—"}</td>
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
          <th style="padding:8px">Поставщик</th>
          <th style="padding:8px;text-align:center">Кол-во</th>
          <th style="padding:8px;text-align:center">Срок</th>
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

export interface VinRequestEmailData {
  vin: string;
  phone: string;
  comment?: string | null;
}

/**
 * Шлёт магазину заявку на подбор запчасти по VIN (форма /vin-search).
 * Уходит на тот же ящик, что и заказы (ORDER_NOTIFICATION_EMAIL).
 * Бросает ошибку при сбое — роут сам решит, что вернуть клиенту.
 */
export async function sendVinRequestNotification(
  data: VinRequestEmailData
): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("SMTP не настроен — заявка по VIN не отправлена");
    throw new Error("SMTP не настроен");
  }

  const to = process.env.ORDER_NOTIFICATION_EMAIL || process.env.SMTP_USER!;
  const from = process.env.MAIL_FROM || process.env.SMTP_USER!;

  const commentHtml = data.comment
    ? `<p style="margin:4px 0"><b>Комментарий:</b><br>${esc(data.comment).replace(/\n/g, "<br>")}</p>`
    : "";

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#222">
    <h2 style="color:#ea580c">Новая заявка на подбор по VIN</h2>
    <p style="margin:4px 0"><b>VIN:</b> <span style="font-family:monospace;font-size:16px">${esc(data.vin)}</span></p>
    <p style="margin:4px 0"><b>Телефон:</b> ${esc(data.phone)}</p>
    ${commentHtml}
    <p style="margin-top:16px;color:#888;font-size:12px">Заявка отправлена с формы «Запрос по VIN» на сайте.</p>
  </div>`;

  await transporter.sendMail({
    from: `"BroCar — запрос по VIN" <${from}>`,
    to,
    subject: `Заявка по VIN: ${data.vin}`,
    html,
  });
}

// ── Письма ПОКУПАТЕЛЮ ────────────────────────────────────────────────────────

export interface CustomerOrderEmailData {
  to: string; // почта покупателя (contactEmail || email аккаунта)
  orderId: number;
  total: number;
  items: OrderEmailItem[];
}

/** Простой email-валидатор — чтобы не дёргать SMTP с пустым/битым адресом. */
function isEmail(v: string | null | undefined): v is string {
  return !!v && /.+@.+\..+/.test(v);
}

/** Таблица позиций для писем покупателю (наименование/артикул/кол-во/сумма). */
function customerItemsTable(items: OrderEmailItem[], total: number): string {
  const rows = items
    .map(
      (i) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee">${esc(i.name)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-family:monospace">${esc(i.article)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.qty}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatRub(parseFloat(i.price) * i.qty)}</td>
      </tr>`
    )
    .join("");
  return `
    <table style="border-collapse:collapse;width:100%;margin-top:16px;font-size:14px">
      <thead>
        <tr style="background:#f5f5f5;text-align:left">
          <th style="padding:8px">Наименование</th>
          <th style="padding:8px">Артикул</th>
          <th style="padding:8px;text-align:center">Кол-во</th>
          <th style="padding:8px;text-align:right">Сумма</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin-top:16px;font-size:18px"><b>Итого: ${formatRub(total)}</b></p>`;
}

/**
 * Фирменная обёртка письма покупателю: тёмная шапка с логотипом BroCar +
 * светлая карточка с содержимым. intro — доверенный HTML (без пользовательского
 * ввода), остальное экранируется.
 */
function customerEmailShell(opts: {
  headingColor: string;
  heading: string;
  intro: string;
  items: OrderEmailItem[];
  total: number;
}): string {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "BroCar";
  // Текущий логотип сайта (тот же, что в шапке). PNG — webp в письмах не везде
  // показывается. Логотип круглый → border-radius:50%.
  const logoUrl = "https://brocarparts.ru/Logo_Brocar.png";
  return `
  <div style="background:#f4f4f5;padding:24px 12px;font-family:Arial,sans-serif">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #eee;border-radius:12px;overflow:hidden">
      <div style="background:#0d0d0d;padding:20px;text-align:center">
        <img src="${logoUrl}" alt="${esc(siteName)}" width="96" height="96" style="display:inline-block;border-radius:50%" />
      </div>
      <div style="padding:24px;color:#222">
        <h2 style="color:${opts.headingColor};margin:0 0 8px">${esc(opts.heading)}</h2>
        <p style="margin:8px 0;line-height:1.5">${opts.intro}</p>
        ${customerItemsTable(opts.items, opts.total)}
      </div>
      <div style="background:#f4f4f5;padding:20px 24px;color:#666;font-size:13px;text-align:center;border-top:1px solid #eee;line-height:1.7">
        <div style="font-weight:bold;color:#333;margin-bottom:6px">${esc(siteName)} — автозапчасти, г. Екатеринбург</div>
        Телефон: <a href="tel:+79326006015" style="color:#ea580c;text-decoration:none">+7 (932) 600-60-15</a><br>
        Адрес: ул. Заводская, 16 (1 этаж, район ВИЗ)<br>
        Часы работы: Пн–Пт 10:00–19:00 · Сб 10:00–15:00 · Вс выходной<br>
        <a href="mailto:info@brocar.ru" style="color:#ea580c;text-decoration:none">info@brocar.ru</a> · <a href="https://brocarparts.ru" style="color:#ea580c;text-decoration:none">brocarparts.ru</a>
      </div>
    </div>
  </div>`;
}

/**
 * Письмо ПОКУПАТЕЛЮ: заказ оформлен (подтверждение «мы приняли ваш заказ»).
 * Тихо выходит, если SMTP не настроен или нет валидной почты — заказ важнее письма.
 */
export async function sendOrderPlacedToCustomer(
  data: CustomerOrderEmailData
): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("SMTP не настроен — подтверждение покупателю не отправлено");
    return;
  }
  if (!isEmail(data.to)) return;

  const from = process.env.MAIL_FROM || process.env.SMTP_USER!;
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "BroCar";

  const html = customerEmailShell({
    headingColor: "#ea580c",
    heading: "Спасибо за заказ!",
    intro: `Ваш заказ <b>№${data.orderId}</b> принят, мы уже занимаемся им! Следите за статусом заказа в <a href="https://brocarparts.ru/dashboard" style="color:#ea580c">личном кабинете</a>. По готовности заказа дополнительно оповестим вас.`,
    items: data.items,
    total: data.total,
  });

  await transporter.sendMail({
    from: `"${siteName}" <${from}>`,
    to: data.to,
    subject: `Ваш заказ №${data.orderId} принят`,
    html,
  });
}

/**
 * Письмо ПОКУПАТЕЛЮ: заказ готов к получению.
 */
export async function sendOrderReadyToCustomer(
  data: CustomerOrderEmailData
): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("SMTP не настроен — письмо о готовности не отправлено");
    return;
  }
  if (!isEmail(data.to)) return;

  const from = process.env.MAIL_FROM || process.env.SMTP_USER!;
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "BroCar";

  const html = customerEmailShell({
    headingColor: "#16a34a",
    heading: `Заказ №${data.orderId} готов к получению`,
    intro: "Ваш заказ собран и ждёт вас. Свяжитесь с нами или приезжайте, чтобы забрать.",
    items: data.items,
    total: data.total,
  });

  await transporter.sendMail({
    from: `"${siteName}" <${from}>`,
    to: data.to,
    subject: `Заказ №${data.orderId} готов к получению`,
    html,
  });
}
