import { writeFileSync, mkdirSync } from "fs";
import { deflateSync } from "zlib";

// Generate simple PNG icons for PWA / apple-touch-icon.
// Accent-colored (#d4775b) background — iOS rounds the corners automatically.

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, c]);
}

function makePNG(size, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Draw: accent background with a lighter cupcake-top circle in the center
  const row = size * 3 + 1; // +1 for filter byte
  const raw = Buffer.alloc(row * size);
  const cx = size / 2, cy = size * 0.48, radius = size * 0.3;

  for (let y = 0; y < size; y++) {
    const off = y * row;
    raw[off] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const px = off + 1 + x * 3;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist < radius) {
        // Lighter highlight circle (frosting)
        raw[px] = 240; raw[px + 1] = 232; raw[px + 2] = 223;
      } else {
        raw[px] = r; raw[px + 1] = g; raw[px + 2] = b;
      }
    }
  }

  const idat = deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/icons", { recursive: true });

// Accent color: #d4775b → rgb(212, 119, 91)
for (const size of [180, 192, 512]) {
  const png = makePNG(size, 212, 119, 91);
  writeFileSync(`public/icons/icon-${size}.png`, png);
  console.log(`Created icon-${size}.png (${png.length} bytes)`);
}
