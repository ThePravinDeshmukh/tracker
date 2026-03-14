/**
 * Generates public/icon-192.png and public/icon-512.png
 * Uses only Node.js built-ins (zlib) — no external dependencies.
 * Run: node generate-icons.js
 */

const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ── PNG encoder ───────────────────────────────────────────────────────────────

function crc32(buf) {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const t   = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crcBuf]);
}

function encodePNG(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA

  const stride = 1 + size * 4;
  const raw    = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const pi = (y * size + x) * 4;
      const ri = y * stride + 1 + x * 4;
      raw[ri]   = pixels[pi];
      raw[ri+1] = pixels[pi+1];
      raw[ri+2] = pixels[pi+2];
      raw[ri+3] = pixels[pi+3];
    }
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── SDF helpers ───────────────────────────────────────────────────────────────

/** Signed distance for a rounded rectangle centered at (mx, my). */
function sdfRoundedRect(px, py, mx, my, hw, hh, r) {
  const qx = Math.abs(px - mx) - hw + r;
  const qy = Math.abs(py - my) - hh + r;
  return (
    Math.sqrt(Math.max(qx, 0) ** 2 + Math.max(qy, 0) ** 2) +
    Math.min(Math.max(qx, qy), 0) -
    r
  );
}

/** Signed distance for a diamond (L1 ball) centered at (cx, cy). */
function sdfDiamond(px, py, cx, cy, radius) {
  return Math.abs(px - cx) + Math.abs(py - cy) - radius;
}

/** Convert SDF value to an alpha (1 = inside, 0 = outside, smooth at edge). */
function sdfAlpha(sdf) {
  return Math.max(0, Math.min(1, 0.5 - sdf));
}

/** Linear interpolation between two values. */
function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }

/** Blend a foreground color onto a background by alpha (0–1). */
function blendColor(bg, fg, alpha) {
  return [
    Math.round(lerp(bg[0], fg[0], alpha)),
    Math.round(lerp(bg[1], fg[1], alpha)),
    Math.round(lerp(bg[2], fg[2], alpha)),
  ];
}

// ── Icon drawing ──────────────────────────────────────────────────────────────

/**
 * Icon design (matches app theme):
 *   • Dark background (#0a0a0f)
 *   • Rounded-rect app container (#1a1a26)
 *   • ◈ shape: thick diamond ring in purple gradient + small center dot
 */
function drawIcon(size) {
  const pixels = new Uint8Array(size * size * 4);

  const BG      = [10,  10,  15 ];   // #0a0a0f
  const SURFACE = [26,  26,  38 ];   // #1a1a26
  const ACCENT  = [124, 109, 250];   // #7c6dfa
  const ACCENTL = [152, 138, 252];   // lighter variant for gradient top

  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;

  // Rounded-rect dimensions
  const pad = size * 0.08;
  const hw  = size / 2 - pad;
  const hh  = size / 2 - pad;
  const cr  = size * 0.22;

  // Diamond dimensions
  const outerR = size * 0.30;
  const innerR = size * 0.165;
  const dotR   = size * 0.055;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      let [r, g, b] = BG;

      // Layer 1: rounded rectangle background
      const rrA = sdfAlpha(sdfRoundedRect(x, y, cx, cy, hw, hh, cr));
      if (rrA > 0) [r, g, b] = blendColor([r, g, b], SURFACE, rrA);

      // Layer 2: outer diamond (purple gradient top→bottom)
      const outerA = sdfAlpha(sdfDiamond(x, y, cx, cy, outerR)) * rrA;
      if (outerA > 0) {
        const t = (y - (cy - outerR)) / (2 * outerR);
        const gradColor = [
          Math.round(lerp(ACCENTL[0], ACCENT[0], t)),
          Math.round(lerp(ACCENTL[1], ACCENT[1], t)),
          Math.round(lerp(ACCENTL[2], ACCENT[2], t)),
        ];
        [r, g, b] = blendColor([r, g, b], gradColor, outerA);
      }

      // Layer 3: inner diamond (cut hole → surface color)
      const innerA = sdfAlpha(sdfDiamond(x, y, cx, cy, innerR)) * rrA;
      if (innerA > 0) [r, g, b] = blendColor([r, g, b], SURFACE, innerA);

      // Layer 4: center dot (accent color)
      const dotA = sdfAlpha(sdfDiamond(x, y, cx, cy, dotR)) * rrA;
      if (dotA > 0) [r, g, b] = blendColor([r, g, b], ACCENT, dotA);

      pixels[idx]   = r;
      pixels[idx+1] = g;
      pixels[idx+2] = b;
      pixels[idx+3] = 255;
    }
  }

  return pixels;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const publicDir = path.join(__dirname, 'public');

for (const size of [192, 512]) {
  const pixels = drawIcon(size);
  const png    = encodePNG(size, pixels);
  const out    = path.join(publicDir, `icon-${size}.png`);
  fs.writeFileSync(out, png);
  console.log(`✓  icon-${size}.png  (${(png.length / 1024).toFixed(1)} KB)`);
}
