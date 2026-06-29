// Переносит картинки из Supabase Storage в S3 (VK Object Storage):
//   качает файл по текущему URL → заливает в S3 под тем же ключом brand/article
//   (как основной код) → обновляет product_images.image_url на новый S3-URL.
//
// Идемпотентно/resumable: берёт ТОЛЬКО строки с supabase в URL; уже перенесённые
// (URL уже на S3) не трогает — можно прерывать и запускать повторно.
// По умолчанию DRY (показывает, сколько к переносу). Льёт с --apply.
// Параллелизм: MIGRATE_CONCURRENCY (по умолчанию 6).
//
// Запуск (на VPS):
//   docker exec -u root brocar-app mkdir -p /app/scripts
//   docker cp /var/www/brocar/scripts/. brocar-app:/app/scripts
//   docker exec -u root brocar-app sh -c 'cd /app/scripts && [ -d node_modules/postgres ] || npm i postgres --no-audit --no-fund'
//   docker exec brocar-app node /app/scripts/migrate-images-to-s3.mjs           # превью
//   docker exec brocar-app node /app/scripts/migrate-images-to-s3.mjs --apply   # перенос
import postgres from "postgres";
import axios from "axios";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    try {
      const txt = readFileSync(resolve(process.cwd(), f), "utf8");
      for (const line of txt.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
        if (m && !process.env[m[1]]) {
          let v = m[2].trim();
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
            v = v.slice(1, -1);
          process.env[m[1]] = v;
        }
      }
    } catch {}
  }
}
loadEnv();

const APPLY = process.argv.includes("--apply");
const CONCURRENCY = parseInt(process.env.MIGRATE_CONCURRENCY || "6", 10);

const DB_URL = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("❌ Нет DATABASE_URL / DATABASE_POOLER_URL");
  process.exit(1);
}
for (const k of ["S3_ENDPOINT", "S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_BUCKET"]) {
  if (!process.env[k]) {
    console.error(`❌ Не задан ${k} (нужен S3)`);
    process.exit(1);
  }
}

const sql = postgres(DB_URL, {
  ssl: DB_URL.includes("supabase.com") ? "require" : undefined,
  prepare: !DB_URL.includes("pooler.supabase.com"),
});

const s3 = new S3Client({
  region: process.env.S3_REGION || "ru-msk",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  forcePathStyle: false,
});
const BUCKET = process.env.S3_BUCKET;
const PUBLIC_BASE = (
  process.env.S3_PUBLIC_BASE || `${process.env.S3_ENDPOINT}/${BUCKET}`
).replace(/\/+$/, "");

function safeSegment(v) {
  return String(v || "").replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "");
}
function extFromMime(mime) {
  const m = (mime || "").toLowerCase();
  if (m.includes("webp")) return "webp";
  if (m.includes("png")) return "png";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("gif")) return "gif";
  return "webp";
}

async function migrateOne(row) {
  // 1) скачать текущий файл с Supabase Storage
  const resp = await axios.get(row.image_url, {
    responseType: "arraybuffer",
    timeout: 20000,
    validateStatus: (s) => s === 200,
  });
  const buf = Buffer.from(resp.data);
  if (buf.length === 0) throw new Error("пустой файл");
  const mime = resp.headers["content-type"] || "image/webp";
  const ext = extFromMime(mime);

  // 2) залить в S3 под тем же именем, что генерит основной код
  const path = `${safeSegment(row.brand) || "_"}/${safeSegment(row.article) || "_"}.${ext}`;
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: path,
      Body: buf,
      ContentType: mime,
      ACL: "public-read",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  // 3) обновить ссылку в БД
  const newUrl = `${PUBLIC_BASE}/${path}`;
  await sql`UPDATE product_images SET image_url = ${newUrl}, source = 'migrated-s3' WHERE id = ${row.id}`;
}

async function main() {
  console.log("DB:", DB_URL.replace(/:[^:@]+@/, ":***@"));
  console.log("S3:", PUBLIC_BASE);

  const rows = await sql`
    SELECT id, brand, article, image_url
    FROM product_images
    WHERE image_url LIKE '%supabase%'
    ORDER BY id
  `;
  console.log(`К переносу (URL на Supabase): ${rows.length}`);
  if (rows.length === 0) {
    console.log("✅ Нечего переносить — все картинки уже на S3.");
    await sql.end();
    return;
  }
  if (!APPLY) {
    console.log("\nDRY-режим — ничего не перенесено. Добавь --apply.");
    await sql.end();
    return;
  }

  let done = 0;
  let ok = 0;
  let fail = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < rows.length) {
      const row = rows[cursor++];
      try {
        await migrateOne(row);
        ok++;
      } catch (e) {
        fail++;
        if (fail <= 30)
          console.error(`  ⚠ id=${row.id} ${row.brand}/${row.article}: ${e.message || e}`);
      }
      done++;
      if (done % 200 === 0)
        console.log(`  ${done}/${rows.length} (ок ${ok}, ошибок ${fail})`);
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, CONCURRENCY) }, () => worker())
  );

  console.log(`\n✅ Перенесено: ${ok}, ошибок: ${fail} из ${rows.length}`);
  if (fail)
    console.log(
      "Ошибочные остались с supabase-URL (файл мог быть удалён) — повторный запуск возьмёт их снова; либо переподтянутся прогревом."
    );

  const [{ left }] =
    await sql`SELECT count(*)::int AS left FROM product_images WHERE image_url LIKE '%supabase%'`;
  console.log(`Осталось на Supabase: ${left}`);

  await sql.end();
}

main().catch((e) => {
  console.error("❌ Ошибка:", e.message || e);
  process.exit(1);
});
