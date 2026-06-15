#!/usr/bin/env node
/**
 * Автоматический приём прайс-листа Berg из почты и запуск импорта.
 *
 * Запуск (Node 22+):
 *   node --env-file=.env.local scripts/import-berg-from-email.mjs
 *
 * Что делает:
 *   1. Заходит в почтовый ящик по IMAP (по умолчанию info@brocarparts.ru на Beget).
 *   2. Ищет НЕпрочитанные письма от Berg за последние дни с вложением BERG_*.csv.
 *   3. Берёт самое свежее, сохраняет вложение во временный файл.
 *   4. Запускает наш существующий импорт scripts/import-berg-csv.mjs по этому файлу.
 *   5. При успехе помечает письмо прочитанным (чтобы не импортировать повторно).
 *
 * Фильтр строгий: отправитель содержит «berg» И имя вложения вида BERG_*.csv —
 * поэтому заказы/заявки по VIN на том же ящике не затрагиваются.
 *
 * Для ежедневного запуска повесьте на cron (см. README ниже в коде).
 */

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const HOST = process.env.IMAP_HOST || "imap.beget.com";
const PORT = parseInt(process.env.IMAP_PORT || "993", 10);
const USER = process.env.IMAP_USER || process.env.SMTP_USER;
const PASS = process.env.IMAP_PASSWORD || process.env.SMTP_PASSWORD;
// Подстрока в адресе отправителя и шаблон имени файла прайса.
const SENDER = process.env.BERG_SENDER || "berg";
const FILE_RE = /^BERG_.*\.csv$/i;
// За сколько последних дней смотреть письма.
const SINCE_DAYS = parseInt(process.env.BERG_SINCE_DAYS || "3", 10);

if (!USER || !PASS) {
  console.error(
    "❌ Нет доступа к почте. Задайте IMAP_USER/IMAP_PASSWORD (или SMTP_USER/SMTP_PASSWORD) в .env.local"
  );
  process.exit(1);
}

/** Запускает существующий импорт Berg по пути к CSV. Резолвится при коде 0. */
function runImport(csvPath) {
  return new Promise((res, rej) => {
    const script = resolve(__dirname, "import-berg-csv.mjs");
    const child = spawn(process.execPath, [script, csvPath], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("close", (code) =>
      code === 0 ? res() : rej(new Error(`Импорт завершился с кодом ${code}`))
    );
    child.on("error", rej);
  });
}

async function main() {
  console.log("📧 Приём прайс-листа Berg из почты");
  console.log(`   IMAP: ${USER}@${HOST}:${PORT}`);

  const client = new ImapFlow({
    host: HOST,
    port: PORT,
    secure: true,
    auth: { user: USER, pass: PASS },
    logger: false,
  });

  await client.connect();
  const lock = await client.getMailboxLock("INBOX");

  let picked = null; // { uid, filename, content, date }
  try {
    const since = new Date(Date.now() - SINCE_DAYS * 24 * 60 * 60 * 1000);
    const uids = await client.search(
      { seen: false, since, from: SENDER },
      { uid: true }
    );

    if (!uids || uids.length === 0) {
      console.log("   Новых писем от Berg с прайсом не найдено — выходим.");
      return;
    }

    // Перебираем от новых к старым, берём первое письмо с вложением BERG_*.csv.
    for (const uid of [...uids].sort((a, b) => b - a)) {
      const msg = await client.fetchOne(uid, { source: true }, { uid: true });
      if (!msg || !msg.source) continue;
      const parsed = await simpleParser(msg.source);
      const att = (parsed.attachments || []).find(
        (a) => a.filename && FILE_RE.test(a.filename)
      );
      if (att) {
        picked = {
          uid,
          filename: att.filename,
          content: att.content,
          date: parsed.date,
        };
        break;
      }
    }
  } finally {
    lock.release();
  }

  if (!picked) {
    console.log("   Письма есть, но вложения BERG_*.csv в них нет — выходим.");
    await client.logout();
    return;
  }

  const tmpPath = join(tmpdir(), `berg-${Date.now()}-${picked.filename}`);
  await writeFile(tmpPath, picked.content);
  console.log(`   Найдено: ${picked.filename} (${picked.content.length} байт)`);
  console.log(`   Сохранено: ${tmpPath}`);
  console.log("\n▶️  Запуск импорта…\n");

  try {
    await runImport(tmpPath);
    // Импорт успешен — помечаем письмо прочитанным, чтобы не брать его снова.
    await client.messageFlagsAdd(picked.uid, ["\\Seen"], { uid: true });
    console.log("\n✅ Каталог обновлён, письмо помечено прочитанным.");
  } finally {
    await client.logout();
  }
}

main().catch((e) => {
  console.error("\n❌ Ошибка:", e.message || e);
  process.exit(1);
});
