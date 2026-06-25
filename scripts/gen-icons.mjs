// Перегенерирует все иконки сайта (apple-touch-icon, android-chrome, favicon-*,
// favicon.ico) из нового логотипа public/Logo_Brocar.png — теми же именами,
// поэтому ссылки в app/layout.tsx и app/manifest.ts остаются валидными.
// Запуск:  node scripts/gen-icons.mjs
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = resolve(process.cwd(), "public/Logo_Brocar.png");
const OUT = resolve(process.cwd(), "public");
const BLACK = { r: 0, g: 0, b: 0, alpha: 1 };

// Имя → размер (квадрат). contain + чёрный фон = логотип не обрезается, фон
// сливается с чёрным логотипом. flatten убирает прозрачность (iOS её не любит).
const ICONS = {
  "apple-touch-icon.png": 180,
  "apple-touch-icon-57x57.png": 57,
  "apple-touch-icon-60x60.png": 60,
  "apple-touch-icon-72x72.png": 72,
  "apple-touch-icon-76x76.png": 76,
  "apple-touch-icon-114x114.png": 114,
  "apple-touch-icon-120x120.png": 120,
  "apple-touch-icon-144x144.png": 144,
  "apple-touch-icon-152x152.png": 152,
  "apple-touch-icon-180x180.png": 180,
  "android-chrome-192x192.png": 192,
  "android-chrome-512x512.png": 512,
  "favicon-16x16.png": 16,
  "favicon-32x32.png": 32,
  "favicon-48x48.png": 48,
  "favicon.png": 512,
};

function render(size) {
  return sharp(SRC)
    .flatten({ background: BLACK })
    .resize(size, size, { fit: "contain", background: BLACK })
    .png();
}

// Собираем .ico с PNG внутри (понимают все современные браузеры).
function buildIco(pngBuffer, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count: 1 изображение
  const dir = Buffer.alloc(16);
  dir.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 = 256)
  dir.writeUInt8(size >= 256 ? 0 : size, 1); // height
  dir.writeUInt8(0, 2); // палитра
  dir.writeUInt8(0, 3); // reserved
  dir.writeUInt16LE(1, 4); // planes
  dir.writeUInt16LE(32, 6); // bpp
  dir.writeUInt32LE(pngBuffer.length, 8); // размер данных
  dir.writeUInt32LE(22, 12); // смещение (6 + 16)
  return Buffer.concat([header, dir, pngBuffer]);
}

async function main() {
  console.log("🎨 Генерация иконок из", SRC);
  for (const [name, size] of Object.entries(ICONS)) {
    await render(size).toFile(resolve(OUT, name));
    console.log(`   ✓ ${name} (${size}×${size})`);
  }
  // favicon.ico из 48×48 PNG
  const png48 = await render(48).toBuffer();
  writeFileSync(resolve(OUT, "favicon.ico"), buildIco(png48, 48));
  console.log("   ✓ favicon.ico (48×48)");
  console.log("🎉 Готово");
}

main().catch((e) => {
  console.error("❌ Ошибка:", e.message || e);
  process.exit(1);
});
