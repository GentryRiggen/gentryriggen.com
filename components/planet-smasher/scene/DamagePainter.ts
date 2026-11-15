export type StampKind =
  | "crater"
  | "scorch"
  | "lava"
  | "crack"
  | "ice"
  | "trench"
  | "goo"
  | "abduct"
  | "flood";

export interface StampEllipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/**
 * Where a round hit of angular `radius` lands on an equirectangular canvas:
 * wider near the poles (capped), with a copy across the seam when needed.
 */
export function stampEllipses(
  u: number,
  v: number,
  radius: number,
  width: number,
  height: number
): StampEllipse[] {
  const lat = (v - 0.5) * Math.PI;
  const rx = ((radius / (2 * Math.PI)) * width) / Math.max(Math.cos(lat), 0.15);
  const ry = (radius / Math.PI) * height;
  const cx = u * width;
  const cy = (1 - v) * height;
  const out: StampEllipse[] = [{ cx, cy, rx, ry }];
  // Near a pole the main ellipse already covers the whole row; a seam copy
  // would make multiply stamps dig the same ground twice.
  if (2.4 * rx > width) return out;
  // Crater blobs reach about 1.65 radii, so copy across the seam early.
  if (cx - 1.7 * rx < 0) out.push({ cx: cx + width, cy, rx, ry });
  if (cx + 1.7 * rx > width) out.push({ cx: cx - width, cy, rx, ry });
  return out;
}

/**
 * Per-hit dig factors on the height map (multiply: grey / 255 of what is
 * left). Exported so tests can pin how fast repeated hits reach the core.
 */
export const CRATER_CENTRE_GREY = 140;
export const CRATER_CENTRE_DIG = CRATER_CENTRE_GREY / 255;
export const CRACK_CORE_GREY = 60;
export const CRACK_CORE_DIG = CRACK_CORE_GREY / 255;
/** Untouched ground on the height map. */
export const HEIGHT_NEUTRAL = 128 / 255;
/** The rim is never pushed above this grey, so hits cannot build walls. */
export const CRATER_RIM_GREY = 150;

const DAMAGE_W = 2048;
const DAMAGE_H = 1024;
const GLOW_W = 1024;
const GLOW_H = 512;
const HEIGHT_W = 1024;
const HEIGHT_H = 512;

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** Small seeded generator so a stamp has the same look every time. */
function rng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Ctx = CanvasRenderingContext2D;

/** Radial blob in unit-circle space (the ellipse transform is applied). */
function blob(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  stops: [number, string][]
) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  for (const [at, color] of stops) g.addColorStop(at, color);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Layers of the planet's damage, each with its own resolution. */
interface Layers {
  damage: Ctx;
  glow: Ctx;
  lights: Ctx;
  height: Ctx;
}

export type LayerKey = keyof Layers;
const SCALE: Record<LayerKey, number> = {
  damage: 1,
  lights: 1,
  glow: 0.5,
  height: 0.5,
};

export class DamagePainter {
  readonly damage = makeCanvas(DAMAGE_W, DAMAGE_H);
  readonly glow = makeCanvas(GLOW_W, GLOW_H);
  readonly lights = makeCanvas(DAMAGE_W, DAMAGE_H);
  readonly height = makeCanvas(HEIGHT_W, HEIGHT_H);
  version = 0;
  /** Layers stamped since the last takeDirty (so only those re-upload). */
  private dirty = new Set<LayerKey>();

  private ctx: Layers | null;
  private count = 0;

  constructor(lights: CanvasImageSource | null) {
    const damage = this.damage.getContext("2d");
    const glow = this.glow.getContext("2d");
    const lightsCtx = this.lights.getContext("2d");
    const height = this.height.getContext("2d");
    this.ctx =
      damage && glow && lightsCtx && height
        ? { damage, glow, lights: lightsCtx, height }
        : null;
    this.reset(lights);
    this.version = 0;
  }

  reset(lights: CanvasImageSource | null): void {
    const c = this.ctx;
    if (c) {
      c.damage.clearRect(0, 0, DAMAGE_W, DAMAGE_H);
      c.glow.fillStyle = "#000";
      c.glow.fillRect(0, 0, GLOW_W, GLOW_H);
      c.height.fillStyle = "rgb(128,128,128)";
      c.height.fillRect(0, 0, HEIGHT_W, HEIGHT_H);
      c.lights.globalCompositeOperation = "source-over";
      c.lights.fillStyle = "#000";
      c.lights.fillRect(0, 0, DAMAGE_W, DAMAGE_H);
      if (lights) c.lights.drawImage(lights, 0, 0, DAMAGE_W, DAMAGE_H);
    }
    this.count = 0;
    this.markAll();
    this.version++;
  }

  private markAll() {
    for (const k of ["damage", "glow", "lights", "height"] as const) {
      this.dirty.add(k);
    }
  }

  /** The layers changed since the last call; clears the list. */
  takeDirty(): Set<LayerKey> {
    const out = this.dirty;
    this.dirty = new Set();
    return out;
  }

  /** Runs `draw` once per ellipse copy, in that ellipse's unit space. */
  private each(
    layer: LayerKey,
    ellipses: StampEllipse[],
    draw: (ctx: Ctx) => void
  ) {
    const ctx = this.ctx?.[layer];
    if (!ctx) return;
    this.dirty.add(layer);
    const k = SCALE[layer];
    for (const e of ellipses) {
      ctx.save();
      ctx.translate(e.cx * k, e.cy * k);
      ctx.scale(Math.max(e.rx * k, 0.5), Math.max(e.ry * k, 0.5));
      draw(ctx);
      ctx.restore();
    }
  }

  private erase(ellipses: StampEllipse[], strength = 1) {
    this.each("lights", ellipses, (ctx) => {
      ctx.globalCompositeOperation = "destination-out";
      blob(ctx, 0, 0, 1.05, [
        [0, `rgba(0,0,0,${strength})`],
        [0.75, `rgba(0,0,0,${strength})`],
        [1, "rgba(0,0,0,0)"],
      ]);
    });
  }

  /** A line along `angle` (0 = east), drawn in canvas pixels per layer. */
  private line(
    layer: LayerKey,
    pts: { x: number; y: number }[],
    width: number,
    color: string,
    composite: GlobalCompositeOperation = "source-over"
  ) {
    const ctx = this.ctx?.[layer];
    if (!ctx) return;
    this.dirty.add(layer);
    const k = SCALE[layer];
    ctx.save();
    ctx.globalCompositeOperation = composite;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(width * k, 1);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // Draw twice more shifted by a full width so a line over the seam wraps.
    const shifts = [-DAMAGE_W, 0, DAMAGE_W];
    for (const dx of shifts) {
      ctx.beginPath();
      pts.forEach((p, i) => {
        const x = (p.x + dx) * k;
        const y = p.y * k;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    ctx.restore();
  }

  stamp(
    kind: StampKind,
    u: number,
    v: number,
    radius: number,
    opts: { angle?: number; length?: number } = {}
  ): void {
    this.count++;
    const rand = rng(
      Math.floor(u * 9973) * 31 + Math.floor(v * 7919) + this.count
    );
    const ellipses = stampEllipses(u, v, radius, DAMAGE_W, DAMAGE_H);
    switch (kind) {
      case "crater":
        this.crater(ellipses, rand);
        break;
      case "abduct":
        this.abduct(ellipses);
        break;
      case "flood":
        this.flood(ellipses, rand);
        break;
      case "scorch":
        this.scorch(ellipses, rand);
        break;
      case "lava":
        this.lava(ellipses, rand);
        break;
      case "ice":
        this.ice(ellipses, rand);
        break;
      case "goo":
        this.goo(ellipses, rand);
        break;
      case "crack":
      case "trench":
        this.stroke(kind, u, v, radius, opts, rand);
        break;
    }
    this.version++;
  }

  private crater(ellipses: StampEllipse[], rand: () => number) {
    this.erase(ellipses, 0.95);
    const ejecta = Array.from({ length: 7 }, () => ({
      a: rand() * Math.PI * 2,
      d: 1 + rand() * 0.35,
      r: 0.12 + rand() * 0.18,
    }));
    this.each("damage", ellipses, (ctx) => {
      blob(ctx, 0, 0, 1.15, [
        [0, "rgba(22,13,9,0.97)"],
        [0.5, "rgba(34,21,14,0.9)"],
        [0.74, "rgba(105,72,48,0.95)"],
        [0.88, "rgba(70,46,30,0.7)"],
        [1, "rgba(50,34,24,0)"],
      ]);
      for (const e of ejecta) {
        blob(ctx, Math.cos(e.a) * e.d, Math.sin(e.a) * e.d, e.r, [
          [0, "rgba(60,40,28,0.6)"],
          [1, "rgba(60,40,28,0)"],
        ]);
      }
    });
    this.each("height", ellipses, (ctx) => {
      // Multiply digs: white leaves the ground alone, so each hit on the same
      // spot cuts deeper (about 0.55 of what is left at the centre).
      ctx.globalCompositeOperation = "multiply";
      blob(ctx, 0, 0, 1.2, [
        [
          0,
          `rgb(${CRATER_CENTRE_GREY},${CRATER_CENTRE_GREY},${CRATER_CENTRE_GREY})`,
        ],
        [0.45, "rgb(172,172,172)"],
        [0.7, "rgb(236,236,236)"],
        [0.82, "rgb(255,255,255)"],
        [1, "rgb(255,255,255)"],
      ]);
      // A soft raised ring (thrown-up rock) just outside the bowl.
      // "lighten" keeps the max, so repeated hits do not stack it into walls.
      ctx.globalCompositeOperation = "lighten";
      const rim = `${CRATER_RIM_GREY},${CRATER_RIM_GREY},${CRATER_RIM_GREY}`;
      blob(ctx, 0, 0, 1.25, [
        [0.6, `rgba(${rim},0)`],
        [0.76, `rgba(${rim},1)`],
        [0.9, `rgba(${rim},0.35)`],
        [1, `rgba(${rim},0)`],
      ]);
    });
  }

  private scorch(ellipses: StampEllipse[], rand: () => number) {
    this.erase(ellipses, 0.9);
    const lobes = Array.from({ length: 5 }, () => ({
      a: rand() * Math.PI * 2,
      d: rand() * 0.45,
      r: 0.4 + rand() * 0.3,
    }));
    this.each("damage", ellipses, (ctx) => {
      blob(ctx, 0, 0, 1.1, [
        [0, "rgba(14,9,6,0.96)"],
        [0.55, "rgba(24,15,10,0.85)"],
        [1, "rgba(24,15,10,0)"],
      ]);
      for (const l of lobes) {
        blob(ctx, Math.cos(l.a) * l.d, Math.sin(l.a) * l.d, l.r, [
          [0, "rgba(10,6,4,0.55)"],
          [1, "rgba(10,6,4,0)"],
        ]);
      }
    });
    this.each("glow", ellipses, (ctx) => {
      ctx.globalCompositeOperation = "lighter";
      blob(ctx, 0, 0, 1, [
        [0, "rgba(40,12,0,0)"],
        [0.7, "rgba(150,50,5,0.45)"],
        [1, "rgba(150,50,5,0)"],
      ]);
    });
    this.each("height", ellipses, (ctx) => {
      // A wide shallow bowl that stacks like the crater's.
      ctx.globalCompositeOperation = "multiply";
      blob(ctx, 0, 0, 1.05, [
        [0, "rgb(158,158,158)"],
        [0.6, "rgb(205,205,205)"],
        [1, "rgb(255,255,255)"],
      ]);
    });
  }

  /** The lights go out in a soft circle; a faint green ring marks the spot. */
  private abduct(ellipses: StampEllipse[]) {
    this.erase(ellipses, 1);
    this.each("damage", ellipses, (ctx) => {
      blob(ctx, 0, 0, 1.1, [
        [0, "rgba(120,255,160,0)"],
        [0.62, "rgba(120,255,160,0)"],
        [0.8, "rgba(120,255,160,0.25)"],
        [0.95, "rgba(120,255,160,0.1)"],
        [1, "rgba(120,255,160,0)"],
      ]);
    });
  }

  /**
   * A muddy brown-blue wash at 0.5 opacity: the lights go out, the height is
   * left alone, and a few darker silt patches keep it from looking flat.
   */
  private flood(ellipses: StampEllipse[], rand: () => number) {
    this.erase(ellipses, 1);
    const silt = Array.from({ length: 6 }, () => ({
      a: rand() * Math.PI * 2,
      d: rand() * 0.6,
      r: 0.3 + rand() * 0.3,
    }));
    this.each("damage", ellipses, (ctx) => {
      blob(ctx, 0, 0, 1.1, [
        [0, "rgba(74,82,92,0.5)"],
        [0.6, "rgba(78,86,96,0.5)"],
        [0.9, "rgba(84,92,100,0.3)"],
        [1, "rgba(84,92,100,0)"],
      ]);
      for (const s of silt) {
        blob(ctx, Math.cos(s.a) * s.d, Math.sin(s.a) * s.d, s.r, [
          [0, "rgba(96,78,58,0.3)"],
          [1, "rgba(96,78,58,0)"],
        ]);
      }
    });
  }

  private lava(ellipses: StampEllipse[], rand: () => number) {
    this.erase(ellipses, 1);
    const pools = Array.from({ length: 8 }, () => ({
      a: rand() * Math.PI * 2,
      d: rand() * 0.6,
      r: 0.28 + rand() * 0.3,
    }));
    this.each("damage", ellipses, (ctx) => {
      blob(ctx, 0, 0, 1.1, [
        [0, "rgba(40,16,8,0.95)"],
        [0.7, "rgba(55,24,12,0.8)"],
        [1, "rgba(55,24,12,0)"],
      ]);
      for (const p of pools) {
        blob(ctx, Math.cos(p.a) * p.d, Math.sin(p.a) * p.d, p.r, [
          [0, "rgba(255,200,60,0.95)"],
          [0.4, "rgba(255,95,20,0.9)"],
          [1, "rgba(200,40,10,0)"],
        ]);
      }
    });
    this.each("glow", ellipses, (ctx) => {
      ctx.globalCompositeOperation = "lighter";
      blob(ctx, 0, 0, 1, [
        [0, "rgba(255,110,20,0.9)"],
        [0.6, "rgba(230,70,10,0.6)"],
        [1, "rgba(200,40,0,0)"],
      ]);
    });
    this.each("height", ellipses, (ctx) => {
      // A cone: a steep dark caldera in the middle (it glows as magma), a
      // high rim ring around it, then the slope easing back to the ground.
      blob(ctx, 0, 0, 1.1, [
        [0, "rgb(14,14,14)"],
        [0.15, "rgb(22,22,22)"],
        [0.23, "rgb(217,217,217)"],
        [0.4, "rgb(200,200,200)"],
        [0.7, "rgba(160,160,160,0.7)"],
        [1, "rgba(128,128,128,0)"],
      ]);
    });
  }

  private ice(ellipses: StampEllipse[], rand: () => number) {
    this.erase(ellipses, 0.85);
    const flakes = Array.from({ length: 9 }, () => ({
      a: rand() * Math.PI * 2,
      d: rand() * 0.85,
      r: 0.1 + rand() * 0.2,
    }));
    this.each("damage", ellipses, (ctx) => {
      blob(ctx, 0, 0, 1.05, [
        [0, "rgba(235,248,255,0.95)"],
        [0.6, "rgba(190,225,250,0.85)"],
        [1, "rgba(170,210,245,0)"],
      ]);
      for (const f of flakes) {
        blob(ctx, Math.cos(f.a) * f.d, Math.sin(f.a) * f.d, f.r, [
          [0, "rgba(255,255,255,0.9)"],
          [1, "rgba(255,255,255,0)"],
        ]);
      }
    });
  }

  /**
   * A blob of silver nanobot goo: a lighter centre highlight, a darker rim, a
   * thin faint cyan edge on the glow layer, and the lights put out.
   */
  private goo(ellipses: StampEllipse[], rand: () => number) {
    this.erase(ellipses, 1);
    const lumps = Array.from({ length: 5 }, () => ({
      a: rand() * Math.PI * 2,
      d: 0.3 + rand() * 0.55,
      r: 0.18 + rand() * 0.2,
    }));
    this.each("damage", ellipses, (ctx) => {
      blob(ctx, 0, 0, 1.05, [
        [0, "rgba(214,220,228,0.97)"],
        [0.5, "rgba(158,166,178,0.96)"],
        [0.82, "rgba(104,112,124,0.96)"],
        [0.94, "rgba(52,58,68,0.9)"],
        [1, "rgba(40,46,56,0)"],
      ]);
      for (const l of lumps) {
        const x = Math.cos(l.a) * l.d;
        const y = Math.sin(l.a) * l.d;
        blob(ctx, x, y, l.r, [
          [0, "rgba(232,238,245,0.7)"],
          [1, "rgba(232,238,245,0)"],
        ]);
      }
      // The bright highlight sits up and to the left of the centre.
      blob(ctx, -0.25, -0.25, 0.4, [
        [0, "rgba(255,255,255,0.85)"],
        [1, "rgba(255,255,255,0)"],
      ]);
    });
    this.each("glow", ellipses, (ctx) => {
      ctx.globalCompositeOperation = "lighter";
      blob(ctx, 0, 0, 1.05, [
        [0, "rgba(20,100,120,0)"],
        [0.72, "rgba(20,100,120,0)"],
        [0.9, "rgba(40,170,200,0.2)"],
        [1, "rgba(40,170,200,0)"],
      ]);
    });
  }

  /** A jagged crack (angle in radians, 0 = east) or a short laser trench. */
  private stroke(
    kind: "crack" | "trench",
    u: number,
    v: number,
    radius: number,
    opts: { angle?: number; length?: number },
    rand: () => number
  ) {
    const crack = kind === "crack";
    const angle = opts.angle ?? rand() * Math.PI * 2;
    const length = opts.length ?? (crack ? 0.8 : radius * 2);
    const lat = (v - 0.5) * Math.PI;
    const pxPerRadX = DAMAGE_W / (2 * Math.PI) / Math.max(Math.cos(lat), 0.15);
    const pxPerRadY = DAMAGE_H / Math.PI;
    const x0 = u * DAMAGE_W;
    const y0 = (1 - v) * DAMAGE_H;
    const steps = crack ? 16 : 3;
    const width = Math.max(2, radius * pxPerRadY * (crack ? 0.22 : 1.2));
    const path = (
      a: number,
      len: number,
      n: number,
      sx: number,
      sy: number
    ) => {
      const dirX = Math.cos(a);
      const dirY = -Math.sin(a); // canvas y points south
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i <= n; i++) {
        const t = (i / n) * len;
        const jitter = crack && i > 0 ? (rand() - 0.5) * len * 0.18 : 0;
        pts.push({
          x: sx + (dirX * t - dirY * jitter) * pxPerRadX,
          y: sy + (dirY * t + dirX * jitter) * pxPerRadY,
        });
      }
      return pts;
    };
    const main = path(angle, length, steps, x0, y0);
    this.carve(main, width, 1, crack);
    if (!crack) return;
    // Short side cracks branch off at random points, thinner and shallower.
    const branches = 3 + Math.floor(rand() * 3);
    for (let b = 0; b < branches; b++) {
      const at = main[2 + Math.floor(rand() * (main.length - 4))];
      const side = rand() < 0.5 ? -1 : 1;
      const a = angle + side * (0.6 + rand() * 0.6);
      const len = length * (0.15 + rand() * 0.15);
      this.carve(path(a, len, 5, at.x, at.y), width * 0.55, 0.6, true);
    }
  }

  /**
   * One crack or trench along `pts`: lights out, a dark scar, a glowing seam
   * and a multiply-dug groove (so repeats cut deeper). `depth` 1 is the main
   * crack; less is shallower.
   */
  private carve(
    pts: { x: number; y: number }[],
    width: number,
    depth: number,
    crack: boolean
  ) {
    this.line("lights", pts, width * 3, "rgba(0,0,0,1)", "destination-out");
    this.line("damage", pts, width * 2.2, "rgba(22,14,10,0.9)");
    this.line("glow", pts, width * 0.8, "rgba(255,100,20,0.55)", "lighter");
    this.line("glow", pts, width * 0.3, "rgba(255,200,110,0.7)", "lighter");
    const grey = (g: number) => {
      const c = Math.round(255 - (255 - g) * depth);
      return `rgb(${c},${c},${c})`;
    };
    if (crack) {
      // A wide soft slope, then a narrow very dark core (reaches the magma).
      this.line("height", pts, width * 3, grey(205), "multiply");
      this.line("height", pts, width * 1.6, grey(150), "multiply");
      this.line("height", pts, width * 0.7, grey(CRACK_CORE_GREY), "multiply");
    } else {
      // Holding the laser carves the groove deeper.
      this.line("height", pts, width * 1.2, "rgb(170,170,170)", "multiply");
    }
  }
}
