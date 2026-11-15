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
  // Crater blobs reach about 1.65 radii, so copy across the seam early.
  if (cx - 1.7 * rx < 0) out.push({ cx: cx + width, cy, rx, ry });
  if (cx + 1.7 * rx > width) out.push({ cx: cx - width, cy, rx, ry });
  return out;
}

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
        [0, "rgb(140,140,140)"],
        [0.45, "rgb(172,172,172)"],
        [0.7, "rgb(236,236,236)"],
        [0.82, "rgb(255,255,255)"],
        [1, "rgb(255,255,255)"],
      ]);
      // A soft raised ring (thrown-up rock) just outside the bowl.
      ctx.globalCompositeOperation = "lighter";
      blob(ctx, 0, 0, 1.25, [
        [0.6, "rgba(255,255,255,0)"],
        [0.76, "rgba(255,255,255,0.09)"],
        [0.9, "rgba(255,255,255,0.03)"],
        [1, "rgba(255,255,255,0)"],
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
      blob(ctx, 0, 0, 1, [
        [0, "rgba(160,160,160,0.8)"],
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
    const length = opts.length ?? (crack ? 0.6 : radius * 2);
    const lat = (v - 0.5) * Math.PI;
    const pxPerRadX = DAMAGE_W / (2 * Math.PI) / Math.max(Math.cos(lat), 0.15);
    const pxPerRadY = DAMAGE_H / Math.PI;
    const x0 = u * DAMAGE_W;
    const y0 = (1 - v) * DAMAGE_H;
    const steps = crack ? 16 : 3;
    const dirX = Math.cos(angle);
    const dirY = -Math.sin(angle); // canvas y points south
    const width = Math.max(2, radius * pxPerRadY * (crack ? 0.22 : 1.2));
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * length;
      const jitter = crack && i > 0 ? (rand() - 0.5) * length * 0.18 : 0;
      pts.push({
        x: x0 + (dirX * t - dirY * jitter) * pxPerRadX,
        y: y0 + (dirY * t + dirX * jitter) * pxPerRadY,
      });
    }
    // The wider erase/dark pass, then the bright core.
    this.line("lights", pts, width * 3, "rgba(0,0,0,1)", "destination-out");
    this.line("damage", pts, width * 2.2, "rgba(22,14,10,0.9)");
    this.line("glow", pts, width * 1.2, "rgba(255,110,20,0.9)", "lighter");
    this.line("glow", pts, width * 0.5, "rgba(255,210,120,0.9)", "lighter");
    if (crack) {
      this.line("height", pts, width * 1.2, "rgba(45,45,45,0.95)");
    } else {
      // Multiply, so holding the laser carves the groove deeper.
      this.line("height", pts, width * 1.2, "rgb(170,170,170)", "multiply");
    }
  }
}
