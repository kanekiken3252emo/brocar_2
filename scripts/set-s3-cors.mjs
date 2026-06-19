// Настраивает CORS бакета S3, чтобы браузер мог грузить истории напрямую (PUT).
// Запуск:  npm run s3:cors   (или node scripts/set-s3-cors.mjs)
import {
  S3Client,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
} from "@aws-sdk/client-s3";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Загружаем .env.local / .env вручную (без зависимостей).
function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    try {
      const txt = readFileSync(resolve(process.cwd(), f), "utf8");
      for (const line of txt.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
        if (m && !process.env[m[1]]) {
          let v = m[2].trim();
          if (
            (v.startsWith('"') && v.endsWith('"')) ||
            (v.startsWith("'") && v.endsWith("'"))
          ) {
            v = v.slice(1, -1);
          }
          process.env[m[1]] = v;
        }
      }
    } catch {
      // файла нет — ок
    }
  }
}
loadEnv();

for (const k of ["S3_ENDPOINT", "S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_BUCKET"]) {
  if (!process.env[k]) {
    console.error(`❌ Нет ${k} в .env.local`);
    process.exit(1);
  }
}

const client = new S3Client({
  region: process.env.S3_REGION || "ru-msk",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  forcePathStyle: false,
});

try {
  await client.send(
    new PutBucketCorsCommand({
      Bucket: process.env.S3_BUCKET,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedMethods: ["PUT", "GET", "HEAD"],
            AllowedOrigins: [
              "https://brocarparts.ru",
              "https://www.brocarparts.ru",
              "http://localhost:3000",
            ],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    })
  );
  console.log("✅ CORS бакета настроен — браузер может грузить истории напрямую");

  // Читаем обратно — чтобы убедиться, что VK Cloud реально сохранил правила.
  const check = await client.send(
    new GetBucketCorsCommand({ Bucket: process.env.S3_BUCKET })
  );
  console.log("📋 Сохранённый CORS:", JSON.stringify(check.CORSRules, null, 2));
} catch (e) {
  console.error("❌ Ошибка настройки CORS:", e);
  process.exitCode = 1;
}
