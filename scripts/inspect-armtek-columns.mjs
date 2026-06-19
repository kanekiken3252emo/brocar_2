#!/usr/bin/env node
/**
 * READ-ONLY диагностика прайса Армтека: вытаскивает свежий XLSX из почты и
 * печатает СЫРЫЕ ячейки нескольких строк — обычных и «АЛЬТ-формата» (с ™ в
 * колонке артикула). Нужно, чтобы увидеть, где у сдвинутых строк лежит реальная
 * цена, и починить маппинг колонок в import-armtek-from-email.mjs.
 *
 * НИЧЕГО НЕ МЕНЯЕТ: не пишет в БД, НЕ помечает письма прочитанными (peek).
 *
 * Запуск:
 *   node --env-file=.env.local scripts/inspect-armtek-columns.mjs
 *   ARMTEK_SINCE_DAYS=30 node --env-file=.env.local scripts/inspect-armtek-columns.mjs
 */
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import AdmZip from "adm-zip";
import ExcelJS from "exceljs";

const HOST = process.env.IMAP_HOST || "imap.beget.com";
const PORT = parseInt(process.env.IMAP_PORT || "993", 10);
const USER = process.env.IMAP_USER || process.env.SMTP_USER;
const PASS = process.env.IMAP_PASSWORD || process.env.SMTP_PASSWORD;
const SENDER = process.env.ARMTEK_SENDER || "armtek";
const SINCE_DAYS = parseInt(process.env.ARMTEK_SINCE_DAYS || "30", 10);

if (!USER || !PASS) {
  console.error("❌ Нет IMAP-доступа (IMAP_USER/PASSWORD или SMTP_USER/PASSWORD).");
  process.exit(1);
}

// Печатает все непустые ячейки строки с индексами: «[1]=Бренд [2]=... [7]=Цена».
function dumpRow(row, maxCol = 12) {
  const parts = [];
  for (let c = 1; c <= maxCol; c++) {
    const t = String(row.getCell(c).text ?? "").trim();
    if (t) parts.push(`[${c}]=${t.length > 28 ? t.slice(0, 28) + "…" : t}`);
  }
  return parts.join("  ");
}

async function main() {
  console.log(`🔎 Инспекция прайса Армтек (READ-ONLY). IMAP: ${USER}@${HOST}:${PORT}, за ${SINCE_DAYS} дн.`);
  const client = new ImapFlow({
    host: HOST, port: PORT, secure: true,
    auth: { user: USER, pass: PASS }, logger: false,
  });
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  try {
    const since = new Date(Date.now() - SINCE_DAYS * 864e5);
    const uids = await client.search({ since, from: SENDER }, { uid: true });
    console.log(`   Писем от «${SENDER}»: ${uids?.length || 0}`);
    if (!uids?.length) return;

    // Берём самое свежее письмо с zip.
    for (const uid of uids.reverse()) {
      // peek: true — НЕ ставим \Seen.
      const msg = await client.fetchOne(uid, { source: true }, { uid: true });
      if (!msg?.source) continue;
      const parsed = await simpleParser(msg.source);
      const zipAtt = (parsed.attachments || []).find(
        (a) => a.filename && /\.zip$/i.test(a.filename)
      );
      if (!zipAtt) continue;

      const entry = new AdmZip(zipAtt.content)
        .getEntries()
        .find((e) => /\.xlsx$/i.test(e.entryName));
      if (!entry) continue;

      console.log(`\n📄 Файл: ${zipAtt.filename} → ${entry.entryName}`);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(entry.getData());
      const ws = wb.worksheets[0];

      console.log(`\n— ЗАГОЛОВОК (строка 1): —\n  ${dumpRow(ws.getRow(1))}`);

      const normal = [];
      const alt = [];
      ws.eachRow((row, rn) => {
        if (rn === 1) return;
        const c2 = String(row.getCell(2).text ?? "");
        if (c2.includes("™")) {
          if (alt.length < 6) alt.push(rn);
        } else if (normal.length < 4) {
          normal.push(rn);
        }
      });

      console.log(`\n— ОБЫЧНЫЕ строки (без ™): —`);
      for (const rn of normal) console.log(`  r${rn}: ${dumpRow(ws.getRow(rn))}`);

      console.log(`\n— «АЛЬТ-ФОРМАТ» (™ в колонке 2) — где тут реальная цена?: —`);
      if (alt.length === 0) console.log("  (строк с ™ в колонке 2 не найдено)");
      for (const rn of alt) console.log(`  r${rn}: ${dumpRow(ws.getRow(rn))}`);

      break; // достаточно одного файла
    }
  } finally {
    lock.release();
    await client.logout();
  }
}

main().catch((e) => {
  console.error("\n❌ Ошибка:", e.message || e);
  process.exit(1);
});
