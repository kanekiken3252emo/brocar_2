declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SUPABASE_URL: string;
      SUPABASE_ANON_KEY: string;
      SUPABASE_SERVICE_ROLE_KEY: string;
      DATABASE_URL: string;
      VENDOR_A_URL: string;
      VENDOR_A_KEY: string;
      VENDOR_B_URL: string;
      VENDOR_B_KEY: string;
      PAYMENT_PROVIDER: "yookassa" | "cloudpayments";
      PAYMENT_SHOP_ID: string;
      PAYMENT_SECRET_KEY: string;
      PAYMENT_RETURN_URL: string;
      NEXT_PUBLIC_SITE_NAME: string;
      NEXT_PUBLIC_SITE_DOMAIN: string;
      CRON_SECRET_TOKEN?: string;
    }
  }
}

export {};




