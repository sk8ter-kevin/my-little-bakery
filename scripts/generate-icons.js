import { writeFileSync, mkdirSync } from "fs";
import { deflateSync } from "zlib";

// Generate cupcake PNG icons for PWA / apple-touch-icon.
// iOS rounds the corners automatically.

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

// Blend two colors: returns [r, g, b]
function blend(fg, bg, t) {
  return [
    Math.round(fg[0] * t + bg[0] * (1 - t)),
    Math.round(fg[1] * t + bg[1] * (1 - t)),
    Math.round(fg[2] * t + bg[2] * (1 - t)),
  ];
}

// Smooth edge: returns 0..1 (1 = fully inside)
function smooth(dist, edge, feather = 1.5) {
  if (dist < edge - feather) return 1;
  if (dist > edge + feather) return 0;
  return (edge + feather - dist) / (feather * 2);
}

function makeCupcakePNG(size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const S = size; // shorthand
  const row = S * 3 + 1;
  const raw = Buffer.alloc(row * S);

  // Colors
  const bg      = [250, 246, 241]; // warm cream #faf6f1
  const accent  = [212, 119, 91];  // coral #d4775b
  const wrapper = [184, 96, 74];   // darker coral #b8604a
  const frost   = [255, 248, 243]; // cream white
  const frostB  = [245, 220, 205]; // frosting shadow
  const cherry  = [193, 57, 43];   // red #c1392b
  const cherSh  = [160, 40, 30];   // cherry shadow

  // Cupcake geometry (relative to size)
  const cx = S * 0.5;

  // Wrapper: trapezoid
  const wrapTop    = S * 0.55;
  const wrapBottom = S * 0.82;
  const wrapTopHW  = S * 0.22;  // half-width at top
  const wrapBotHW  = S * 0.16;  // half-width at bottom

  // Frosting: big swirl dome
  const frostCY = S * 0.42;
  const frostRX = S * 0.26;
  const frostRY = S * 0.2;

  // Two side swirls
  const swirlLCX = cx - S * 0.14;
  const swirlRCX = cx + S * 0.14;
  const swirlCY  = S * 0.5;
  const swirlR   = S * 0.13;

  // Cherry on top
  const cherryCY = S * 0.24;
  const cherryR  = S * 0.065;

  // Cherry stem
  const stemBaseY = cherryCY - cherryR * 0.5;

  for (let y = 0; y < S; y++) {
    const off = y * row;
    raw[off] = 0; // filter: none

    for (let x = 0; x < S; x++) {
      const px = off + 1 + x * 3;
      let color = bg;

      // ── Wrapper (trapezoid) ──
      if (y >= wrapTop && y <= wrapBottom) {
        const t = (y - wrapTop) / (wrapBottom - wrapTop);
        const hw = wrapTopHW + (wrapBotHW - wrapTopHW) * t;
        const edgeDist = hw - Math.abs(x - cx);
        const a = smooth(0, edgeDist, 1.5);
        if (a > 0) {
          // Wrapper lines (horizontal stripes for texture)
          const stripe = Math.sin(y * Math.PI * 0.3) * 0.5 + 0.5;
          const wc = blend(wrapper, [170, 85, 65], stripe * 0.15);
          color = blend(wc, color, a);
        }
      }

      // ── Frosting dome (center) ──
      {
        const dx = (x - cx) / frostRX;
        const dy = (y - frostCY) / frostRY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const a = smooth(dist, 1.0, 0.06);
        if (a > 0) {
          // Slight gradient: lighter at top, hint of shadow at bottom
          const gt = Math.max(0, Math.min(1, (y - (frostCY - frostRY)) / (frostRY * 2)));
          const fc = blend(frostB, frost, 1 - gt * 0.4);
          color = blend(fc, color, a);
        }
      }

      // ── Side swirls ──
      for (const scx of [swirlLCX, swirlRCX]) {
        const dist = Math.sqrt((x - scx) ** 2 + (y - swirlCY) ** 2);
        const a = smooth(dist, swirlR, 1.5);
        if (a > 0) {
          const gt = Math.max(0, Math.min(1, (y - (swirlCY - swirlR)) / (swirlR * 2)));
          const fc = blend(frostB, frost, 1 - gt * 0.35);
          color = blend(fc, color, a);
        }
      }

      // ── Cherry stem ──
      {
        const stemW = S * 0.008;
        if (Math.abs(x - cx) < stemW && y > stemBaseY - S * 0.08 && y < stemBaseY) {
          color = [100, 70, 40];
        }
      }

      // ── Cherry ──
      {
        const dist = Math.sqrt((x - cx) ** 2 + (y - cherryCY) ** 2);
        const a = smooth(dist, cherryR, 1.5);
        if (a > 0) {
          // Highlight on upper-left
          const hlDist = Math.sqrt((x - (cx - cherryR * 0.3)) ** 2 + (y - (cherryCY - cherryR * 0.3)) ** 2);
          const hl = smooth(hlDist, cherryR * 0.35, 2);
          const cc = blend([230, 100, 90], cherry, hl * 0.6);
          // Shadow on lower-right
          const shDist = Math.sqrt((x - (cx + cherryR * 0.2)) ** 2 + (y - (cherryCY + cherryR * 0.3)) ** 2);
          const sh = smooth(shDist, cherryR * 0.5, 2);
          const cc2 = blend(cherSh, cc, sh * 0.3);
          color = blend(cc2, color, a);
        }
      }

      raw[px]     = color[0];
      raw[px + 1] = color[1];
      raw[px + 2] = color[2];
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

for (const size of [180, 192, 512]) {
  const png = makeCupcakePNG(size);
  writeFileSync(`public/icons/icon-${size}.png`, png);
  console.log(`Created icon-${size}.png (${png.length} bytes)`);
}
