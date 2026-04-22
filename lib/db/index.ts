import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Приоритет: pooler (работает везде, и IPv4, и serverless) → direct (может
// блокироваться сетью/провайдером). На Vercel добавь DATABASE_POOLER_URL.
const connectionString =
  process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL!;

const isPooler = connectionString.includes("pooler.supabase.com");

export const client = postgres(connectionString, {
  // Transaction pooler не поддерживает prepared statements — отключаем.
  prepare: !isPooler,
  // Supabase-хосты всегда требуют SSL.
  ssl: connectionString.includes("supabase.com") ? "require" : undefined,
  // В serverless / dev не держим много соединений
  max: isPooler ? 10 : 5,
  idle_timeout: 20,
  connect_timeout: 15,
});

export const db = drizzle(client, { schema });




