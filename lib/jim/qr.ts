/**
 * A small QR code encoder (ISO/IEC 18004), drawn on the device so a setup
 * link that holds a secret never goes to a QR service. Byte mode, error
 * correction level M, versions 1 to 40, the mask with the lowest penalty.
 * Follows the structure of Project Nayuki's QR Code generator (MIT).
 */

/** Error-correction codewords per block, level M, by version (index 0 unused). */
const ECC_PER_BLOCK = [
  -1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26,
  26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
  28, 28, 28,
];

/** Error-correction blocks, level M, by version (index 0 unused). */
const ECC_BLOCKS = [
  -1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17,
  18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49,
];

/** Level M's two format bits. */
const FORMAT_M = 0;

export interface QrMatrix {
  /** Modules per side (no quiet zone). */
  size: number;
  version: number;
  mask: number;
  /** `dark[y][x]`. */
  dark: boolean[][];
}

function bit(value: number, i: number): boolean {
  return ((value >>> i) & 1) !== 0;
}

function rawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const align = Math.floor(ver / 7) + 2;
    result -= (25 * align - 10) * align - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

function dataCodewords(ver: number): number {
  return (
    Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ver] * ECC_BLOCKS[ver]
  );
}

function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i] ^= gfMultiply(coef, factor);
    });
  }
  return result;
}

/** The data codewords with their error correction, split and interleaved. */
function withEcc(data: number[], ver: number): number[] {
  const numBlocks = ECC_BLOCKS[ver];
  const eccLen = ECC_PER_BLOCK[ver];
  const raw = Math.floor(rawDataModules(ver) / 8);
  const numShort = numBlocks - (raw % numBlocks);
  const shortLen = Math.floor(raw / numBlocks);
  const divisor = rsDivisor(eccLen);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, divisor);
    if (i < numShort) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const result: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortLen - eccLen || j >= numShort) result.push(block[i]);
    });
  }
  return result;
}

function alignmentPositions(ver: number): number[] {
  if (ver === 1) return [];
  const count = Math.floor(ver / 7) + 2;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];
  for (let pos = ver * 4 + 17 - 7; result.length < count; pos -= step) {
    result.splice(1, 0, pos);
  }
  return result;
}

class Grid {
  readonly size: number;
  readonly dark: boolean[][];
  readonly fixed: boolean[][];

  constructor(size: number) {
    this.size = size;
    this.dark = Array.from({ length: size }, () =>
      new Array<boolean>(size).fill(false)
    );
    this.fixed = Array.from({ length: size }, () =>
      new Array<boolean>(size).fill(false)
    );
  }

  set(x: number, y: number, dark: boolean): void {
    this.dark[y][x] = dark;
    this.fixed[y][x] = true;
  }
}

function drawFinder(g: Grid, x: number, y: number): void {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      const xx = x + dx;
      const yy = y + dy;
      if (xx >= 0 && xx < g.size && yy >= 0 && yy < g.size) {
        g.set(xx, yy, dist !== 2 && dist !== 4);
      }
    }
  }
}

function drawFormat(g: Grid, mask: number): void {
  const data = (FORMAT_M << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const n = g.size;
  for (let i = 0; i <= 5; i++) g.set(8, i, bit(bits, i));
  g.set(8, 7, bit(bits, 6));
  g.set(8, 8, bit(bits, 7));
  g.set(7, 8, bit(bits, 8));
  for (let i = 9; i < 15; i++) g.set(14 - i, 8, bit(bits, i));
  for (let i = 0; i < 8; i++) g.set(n - 1 - i, 8, bit(bits, i));
  for (let i = 8; i < 15; i++) g.set(8, n - 15 + i, bit(bits, i));
  g.set(8, n - 8, true);
}

function drawVersion(g: Grid, ver: number): void {
  if (ver < 7) return;
  let rem = ver;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  const bits = (ver << 12) | rem;
  for (let i = 0; i < 18; i++) {
    const on = bit(bits, i);
    const a = g.size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    g.set(a, b, on);
    g.set(b, a, on);
  }
}

function drawFunctionPatterns(g: Grid, ver: number): void {
  const n = g.size;
  for (let i = 0; i < n; i++) {
    g.set(6, i, i % 2 === 0);
    g.set(i, 6, i % 2 === 0);
  }
  drawFinder(g, 3, 3);
  drawFinder(g, n - 4, 3);
  drawFinder(g, 3, n - 4);
  const align = alignmentPositions(ver);
  const last = align.length - 1;
  align.forEach((ay, i) => {
    align.forEach((ax, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last)) return;
      if (i === last && j === 0) return;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          g.set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    });
  });
  // Reserved now, overwritten once the mask is known.
  drawFormat(g, 0);
  drawVersion(g, ver);
}

function drawCodewords(g: Grid, codewords: number[]): void {
  const n = g.size;
  let i = 0;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < n; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? n - 1 - vert : vert;
        if (!g.fixed[y][x] && i < codewords.length * 8) {
          g.dark[y][x] = bit(codewords[i >>> 3], 7 - (i & 7));
          i++;
        }
      }
    }
  }
}

function maskHit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

function applyMask(g: Grid, mask: number): void {
  for (let y = 0; y < g.size; y++) {
    for (let x = 0; x < g.size; x++) {
      if (!g.fixed[y][x] && maskHit(mask, x, y)) g.dark[y][x] = !g.dark[y][x];
    }
  }
}

const FINDER_LIKE = [
  [true, false, true, true, true, false, true, false, false, false, false],
  [false, false, false, false, true, false, true, true, true, false, true],
];

/** The standard penalty score: lower scans more reliably. */
export function penalty(dark: boolean[][]): number {
  const n = dark.length;
  const at = (x: number, y: number, row: boolean) =>
    row ? dark[y][x] : dark[x][y];
  let score = 0;
  for (const row of [true, false]) {
    for (let a = 0; a < n; a++) {
      let run = 1;
      for (let b = 1; b <= n; b++) {
        if (b < n && at(b, a, row) === at(b - 1, a, row)) {
          run++;
          continue;
        }
        if (run >= 5) score += 3 + (run - 5);
        run = 1;
      }
      for (let b = 0; b + 11 <= n; b++) {
        for (const pattern of FINDER_LIKE) {
          if (pattern.every((d, k) => at(b + k, a, row) === d)) score += 40;
        }
      }
    }
  }
  for (let y = 0; y + 1 < n; y++) {
    for (let x = 0; x + 1 < n; x++) {
      const c = dark[y][x];
      if (
        c === dark[y][x + 1] &&
        c === dark[y + 1][x] &&
        c === dark[y + 1][x + 1]
      ) {
        score += 3;
      }
    }
  }
  let darkCount = 0;
  for (const r of dark) for (const c of r) if (c) darkCount++;
  const total = n * n;
  const k = Math.ceil(Math.abs(darkCount * 20 - total * 10) / total) - 1;
  score += Math.max(0, k) * 10;
  return score;
}

/** UTF-8 bytes (no TextEncoder needed). */
function utf8(text: string): number[] {
  const out: number[] = [];
  for (const ch of text) {
    const c = ch.codePointAt(0) as number;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    } else {
      out.push(
        0xf0 | (c >> 18),
        0x80 | ((c >> 12) & 63),
        0x80 | ((c >> 6) & 63),
        0x80 | (c & 63)
      );
    }
  }
  return out;
}

/**
 * Encodes `text` (as UTF-8 bytes). `mask` forces one mask (for tests);
 * otherwise the one with the lowest penalty is used. Throws when the text
 * is too long for any version.
 */
export function encodeQr(text: string, mask?: number): QrMatrix {
  const bytes = utf8(text);
  let ver = 1;
  for (; ver <= 40; ver++) {
    const countBits = ver <= 9 ? 8 : 16;
    if (4 + countBits + bytes.length * 8 <= dataCodewords(ver) * 8) break;
  }
  if (ver > 40) throw new RangeError("Too long for a QR code");
  const capacity = dataCodewords(ver) * 8;
  const bits: number[] = [];
  const push = (value: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, ver <= 9 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  push(0, Math.min(4, capacity - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    data.push(bits.slice(i, i + 8).reduce((acc, b) => (acc << 1) | b, 0));
  }
  for (let pad = 0xec; data.length < capacity / 8; pad ^= 0xec ^ 0x11) {
    data.push(pad);
  }

  const size = ver * 4 + 17;
  const base = new Grid(size);
  drawFunctionPatterns(base, ver);
  drawCodewords(base, withEcc(data, ver));

  const build = (m: number): Grid => {
    const g = new Grid(size);
    for (let y = 0; y < size; y++) {
      g.dark[y] = [...base.dark[y]];
      g.fixed[y] = [...base.fixed[y]];
    }
    applyMask(g, m);
    drawFormat(g, m);
    return g;
  };

  let best = mask ?? 0;
  let grid = build(best);
  if (mask === undefined) {
    let bestScore = penalty(grid.dark);
    for (let m = 1; m < 8; m++) {
      const g = build(m);
      const score = penalty(g.dark);
      if (score < bestScore) {
        best = m;
        bestScore = score;
        grid = g;
      }
    }
  }
  return { size, version: ver, mask: best, dark: grid.dark };
}

/** An SVG path (one unit per module) for the dark modules, offset by `quiet`. */
export function qrPath(matrix: QrMatrix, quiet = 4): string {
  const parts: string[] = [];
  matrix.dark.forEach((row, y) => {
    row.forEach((on, x) => {
      if (on) parts.push(`M${x + quiet} ${y + quiet}h1v1h-1z`);
    });
  });
  return parts.join("");
}
