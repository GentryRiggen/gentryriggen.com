import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from "three";

/**
 * The model's procedural textures, drawn once into canvases (nothing is
 * downloaded): the hull plating's seams and rivets as a normal map, a
 * weathering map for the paint, deck planking and the ship's name.
 */

export interface ShipTextures {
  plateNormal: Texture;
  weathering: Texture;
  planks: Texture;
  names: Texture;
  dispose(): void;
}

function canvas(
  w: number,
  h: number
): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2d canvas unavailable");
  return [c, ctx];
}

/** A small deterministic generator (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Plating, as a height field turned into a normal map: two strakes (6 ft)
 * by two plates (30 ft) per tile, the outer strakes standing proud of the
 * inner ones (the in-and-out plating), staggered butts, rivet rows along
 * every seam.
 */
function plateNormalMap(): Texture {
  const W = 1024;
  const H = 256;
  const [c, ctx] = canvas(W, H);
  const height = new Float32Array(W * H);
  const strake = H / 2;
  const plate = W / 2;
  for (let y = 0; y < H; y += 1) {
    const s = Math.floor(y / strake);
    const outer = s % 2 === 0;
    const ys = y % strake;
    // Soft lap edges on the outer strakes.
    const edge = Math.min(ys, strake - 1 - ys);
    const lap = outer ? Math.min(1, edge / 2.5) : 0;
    for (let x = 0; x < W; x += 1) {
      const shift = outer ? 0 : plate / 2;
      const xp = (x + shift) % plate;
      const butt = Math.min(xp, plate - 1 - xp) < 1 ? -0.6 : 0;
      height[y * W + x] = lap + butt;
    }
  }
  // Rivets: rows along the strake edges and the butts.
  const rivet = (cx: number, cy: number) => {
    for (let dy = -2; dy <= 2; dy += 1)
      for (let dx = -2; dx <= 2; dx += 1) {
        const d2 = dx * dx + dy * dy;
        if (d2 > 4.5) continue;
        const x = (cx + dx + W) % W;
        const y = (cy + dy + H) % H;
        height[y * W + x] += 0.9 * (1 - d2 / 5);
      }
  };
  for (let s = 0; s < 2; s += 1) {
    const top = s * strake;
    for (const off of [5, 11, strake - 6, strake - 12]) {
      for (let x = 2; x < W; x += 7) rivet(x, top + off);
    }
    const shift = s % 2 === 0 ? 0 : plate / 2;
    for (let p = 0; p < 2; p += 1) {
      const bx = (p * plate - shift + W) % W;
      for (const off of [-6, 6, -11, 11])
        for (let y = top + 4; y < top + strake - 4; y += 7) rivet(bx + off, y);
    }
  }
  const img = ctx.createImageData(W, H);
  const k = 2.2;
  for (let y = 0; y < H; y += 1)
    for (let x = 0; x < W; x += 1) {
      const hx =
        height[y * W + ((x + 1) % W)] - height[y * W + ((x - 1 + W) % W)];
      const hy =
        height[((y + 1) % H) * W + x] - height[((y - 1 + H) % H) * W + x];
      let nx = -hx * k;
      // Canvas rows run down; texture v runs up.
      let ny = hy * k;
      let nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l;
      ny /= l;
      nz /= l;
      const i = (y * W + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.colorSpace = NoColorSpace;
  t.anisotropy = 4;
  return t;
}

/**
 * Weathering over the whole hull (u along the length, v down the girth):
 * faint mottling, rust weeping from the plate seams, a darker band where
 * the sea washes. A multiplier near white, so the paint stays true.
 */
function weatheringMap(): Texture {
  const W = 1024;
  const H = 128;
  const [c, ctx] = canvas(W, H);
  const rand = rng(1912);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i += 1) {
    const x = rand() * W;
    const y = rand() * H;
    const r = 2 + rand() * 9;
    const g = 220 + Math.floor(rand() * 30);
    ctx.fillStyle = `rgba(${g},${g - 4},${g - 8},0.18)`;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.8, r, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Rust streaks running down from seams and portholes.
  for (let i = 0; i < 260; i += 1) {
    const x = rand() * W;
    const y = rand() * H * 0.7;
    const len = 4 + rand() * 18;
    const grad = ctx.createLinearGradient(x, y, x, y + len);
    grad.addColorStop(0, "rgba(150,96,64,0.16)");
    grad.addColorStop(1, "rgba(150,96,64,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, 0.8 + rand() * 1.2, len);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Pale pine deck planks, 5 in wide, caulked seams, staggered butts. */
function plankMap(): Texture {
  const S = 512;
  const [c, ctx] = canvas(S, S);
  const rand = rng(1911);
  const plankPx = 16;
  for (let y = 0; y < S; y += plankPx) {
    let x = -Math.floor(rand() * 256);
    while (x < S) {
      const len = 280 + Math.floor(rand() * 200);
      const g = 196 + Math.floor(rand() * 34);
      ctx.fillStyle = `rgb(${g},${g - 10},${g - 28})`;
      ctx.fillRect(x, y, len, plankPx);
      // Grain.
      for (let k = 0; k < 6; k += 1) {
        ctx.fillStyle = `rgba(120,90,60,${0.05 + rand() * 0.06})`;
        ctx.fillRect(x, y + 2 + rand() * (plankPx - 4), len, 1);
      }
      ctx.fillStyle = "rgba(60,44,30,0.55)";
      ctx.fillRect(x + len - 1, y, 1, plankPx);
      x += len;
    }
    ctx.fillStyle = "rgba(40,30,22,0.75)";
    ctx.fillRect(0, y, S, 1.4);
  }
  const t = new CanvasTexture(c);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  t.minFilter = LinearMipmapLinearFilter;
  return t;
}

/**
 * The name: e.g. "TITANIC" for the bows (top half), "TITANIC / LIVERPOOL"
 * for the counter (bottom half), in gilt letters.
 */
function nameMap(name: string): Texture {
  const W = 1024;
  const H = 512;
  const [c, ctx] = canvas(W, H);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#e2bf62";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const font = (px: number) => `bold ${px}px Georgia, "Times New Roman", serif`;
  const spaced = (
    text: string,
    x: number,
    y: number,
    px: number,
    track: number
  ) => {
    ctx.font = font(px);
    let widths = Array.from(text).map((ch) => ctx.measureText(ch).width);
    let total = widths.reduce((a, b) => a + b, 0) + track * (text.length - 1);
    // A long name is set smaller to fit (the Titanic's always fits).
    const room = W * 0.96;
    if (total > room) {
      const k = room / total;
      px = Math.floor(px * k);
      track *= k;
      ctx.font = font(px);
      widths = Array.from(text).map((ch) => ctx.measureText(ch).width);
      total = widths.reduce((a, b) => a + b, 0) + track * (text.length - 1);
    }
    let at = x - total / 2;
    Array.from(text).forEach((ch, i) => {
      ctx.fillText(ch, at + widths[i] / 2, y);
      at += widths[i] + track;
    });
  };
  spaced(name, W / 2, H * 0.25, 170, 34);
  spaced(name, W / 2, H * 0.62, 104, 30);
  spaced("LIVERPOOL", W / 2, H * 0.86, 86, 22);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.minFilter = LinearFilter;
  t.generateMipmaps = false;
  t.anisotropy = 4;
  return t;
}

type Shared = Omit<ShipTextures, "names">;
let cache: Shared | null = null;
let users = 0;
const nameCache = new Map<string, { texture: Texture; users: number }>();

/**
 * The shared textures (made on first use, freed when the last user goes),
 * with the name boards of the ship `name`.
 */
export function acquireShipTextures(name = "TITANIC"): ShipTextures {
  users += 1;
  if (!cache) {
    const plateNormal = plateNormalMap();
    const weathering = weatheringMap();
    const planks = plankMap();
    cache = {
      plateNormal,
      weathering,
      planks,
      dispose() {
        plateNormal.dispose();
        weathering.dispose();
        planks.dispose();
      },
    };
  }
  let names = nameCache.get(name);
  if (!names) {
    names = { texture: nameMap(name), users: 0 };
    nameCache.set(name, names);
  }
  names.users += 1;
  const shared = cache;
  const board = names.texture;
  return {
    ...shared,
    names: board,
    // Shared: only frees them when no one else holds them.
    dispose() {
      releaseShipTextures(name);
    },
  };
}

export function releaseShipTextures(name = "TITANIC"): void {
  const names = nameCache.get(name);
  if (names) {
    names.users -= 1;
    if (names.users <= 0) {
      names.texture.dispose();
      nameCache.delete(name);
    }
  }
  users = Math.max(0, users - 1);
  if (users === 0 && cache) {
    cache.dispose();
    cache = null;
  }
}
