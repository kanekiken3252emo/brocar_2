declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SUPABASE_URL: string;
      SUPABASE_ANON_KEY: string;
      SUPABASE_SERVICE_ROLE_KEY: string;
      // S3-хранилище картинок (VK Cloud Object Storage). Если заданы — картинки
      // грузятся в S3; иначе fallback на Supabase Storage.
      S3_ENDPOINT?: string;
      S3_REGION?: string;
      S3_BUCKET?: string;
      S3_ACCESS_KEY?: string;
      S3_SECRET_KEY?: string;
      S3_PUBLIC_BASE?: string;
      DATABASE_URL: string;
      PAYMENT_PROVIDER: "yookassa" | "cloudpayments";
      PAYMENT_SHOP_ID: string;
      PAYMENT_SECRET_KEY: string;
      PAYMENT_RETURN_URL: string;
      // Фискализация чеков (54-ФЗ). "true" — передавать receipt в платёж.
      PAYMENT_SEND_RECEIPT?: string;
      PAYMENT_VAT_CODE?: string; // код ставки НДС (1 = без НДС)
      PAYMENT_TAX_SYSTEM_CODE?: string; // система налогообложения (1=ОСН, 2=УСН доход, ...)
      NEXT_PUBLIC_SITE_NAME: string;
      NEXT_PUBLIC_SITE_DOMAIN: string;
      // SMTP для уведомлений о заказах (почта домена на Beget)
      SMTP_HOST?: string;
      SMTP_PORT?: string;
      SMTP_USER?: string;
      SMTP_PASSWORD?: string;
      MAIL_FROM?: string;
      ORDER_NOTIFICATION_EMAIL?: string;
      // Email'ы администраторов магазина (через запятую) — доступ к /admin
      ADMIN_EMAILS?: string;
    }
  }
}

export {};




