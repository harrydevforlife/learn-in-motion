// Generates the app icons (PNG) with zero dependencies.
// Usage: node scripts/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
mkdirSync(OUT, { recursive: true });

// ---- tiny PNG encoder -------------------------------------------------------
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- signed distance shapes (designed on a 512 canvas) ----------------------
const sdRoundRect = (x, y, cx, cy, w, h, r) => {
  const qx = Math.abs(x - cx) - w / 2 + r, qy = Math.abs(y - cy) - h / 2 + r;
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
};
const sdTriangle = (x, y, [ax, ay], [bx, by], [cx, cy]) => {
  const seg = (px, py, x0, y0, x1, y1) => {
    const ex = x1 - x0, ey = y1 - y0, vx = px - x0, vy = py - y0;
    const t = Math.max(0, Math.min(1, (vx * ex + vy * ey) / (ex * ex + ey * ey)));
    return Math.hypot(vx - ex * t, vy - ey * t);
  };
  const d = Math.min(seg(x, y, ax, ay, bx, by), seg(x, y, bx, by, cx, cy), seg(x, y, cx, cy, ax, ay));
  const s1 = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
  const s2 = (cx - bx) * (y - by) - (cy - by) * (x - bx);
  const s3 = (ax - cx) * (y - cy) - (ay - cy) * (x - cx);
  const inside = (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
  return inside ? -d : d;
};

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const BG = hex('#ffffff'), INK = hex('#111111'), WHITE = hex('#ffffff');

// Layers, back to front: a deck of black feed cards on white, with a white play button on top.
const layers = [
  { color: INK, alpha: 0.12, sd: (x, y) => sdRoundRect(x, y, 256, 222, 152, 260, 32) },
  { color: INK, alpha: 0.32, sd: (x, y) => sdRoundRect(x, y, 256, 252, 186, 260, 36) },
  { color: INK, alpha: 1, sd: (x, y) => sdRoundRect(x, y, 256, 282, 220, 260, 40) },
  { color: WHITE, alpha: 1, sd: (x, y) => sdTriangle(x, y, [234, 242], [234, 322], [302, 282]) - 7 },
];

function render(size) {
  const buf = Buffer.alloc(size * size * 4);
  const SS = 4; // supersampling per axis
  const k = 512 / size;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) * k, y = (py + (sy + 0.5) / SS) * k;
          let c = [...BG];
          for (const L of layers) {
            if (L.sd(x, y) < 0) c = c.map((v, i) => v + (L.color[i] - v) * L.alpha);
          }
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const n = SS * SS, o = (py * size + px) * 4;
      buf[o] = Math.round(r / n); buf[o + 1] = Math.round(g / n); buf[o + 2] = Math.round(b / n); buf[o + 3] = 255;
    }
  }
  return png(size, buf);
}

for (const [name, size] of [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180], ['favicon-32.png', 32]]) {
  writeFileSync(join(OUT, name), render(size));
  console.log('wrote icons/' + name);
}
