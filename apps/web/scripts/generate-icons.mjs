// Writes the placeholder PWA icons: a white "H" on the section-neutral slate, full-bleed so
// the same file works as a maskable icon. Branding defines no app mark yet; replace these
// PNGs when it does. Uses only Node built-ins so it adds no dependency.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const BACKGROUND = [0x47, 0x55, 0x69]; // #475569, Branding Dashboard slate
const FOREGROUND = [0xff, 0xff, 0xff];
const SIZES = [192, 512];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

// The glyph stays well inside the maskable safe zone (a centred circle of radius 0.4 × size).
function isGlyph(x, y, size) {
  const u = (x + 0.5) / size - 0.5;
  const v = (y + 0.5) / size - 0.5;
  const halfWidth = 0.17;
  const halfHeight = 0.2;
  const stem = 0.09;
  const bar = 0.04;
  if (Math.abs(u) > halfWidth || Math.abs(v) > halfHeight) return false;
  const inStem = u < -halfWidth + stem || u > halfWidth - stem;
  const inBar = Math.abs(v) < bar;
  return inStem || inBar;
}

function png(size) {
  const rowLength = 1 + size * 3;
  const raw = Buffer.alloc(rowLength * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * rowLength] = 0; // filter: none
    for (let x = 0; x < size; x += 1) {
      const color = isGlyph(x, y, size) ? FOREGROUND : BACKGROUND;
      raw.set(color, y * rowLength + 1 + x * 3);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });
for (const size of SIZES) {
  writeFileSync(join(outDir, `icon-${String(size)}.png`), png(size));
}
