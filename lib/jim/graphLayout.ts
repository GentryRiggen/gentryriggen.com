/**
 * A small force layout for the note graph, in plain TypeScript (no d3):
 * springs along links, short-range repulsion between nearby notes (a grid
 * keeps it near-linear), and a gentle pull to the centre. Deterministic:
 * notes start on a sunflower spiral, so the same graph lays out the same way.
 */

export interface LayoutLink {
  source: string;
  target: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface LayoutOptions {
  /** At most 300. */
  iterations?: number;
  /** The rest length of a link. */
  linkLength?: number;
}

export const MAX_ITERATIONS = 300;

const REPEL = 2400;
const SPRING = 0.06;
const GRAVITY = 0.012;
const DAMPING = 0.82;
/** Notes further apart than this don't push each other. */
const CUTOFF = 100;
/** A step never moves a note further than this. */
const MAX_STEP = 30;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** One number per grid cell (cells stay well inside ±2^20). */
function cellKey(cx: number, cy: number): number {
  return (cx + 1048576) * 2097152 + (cy + 1048576);
}

/**
 * Steps for a graph of `n` notes: the full 300 for a few hundred notes,
 * fewer for a big one so a phone isn't busy for seconds (never under 80).
 */
export function iterationsFor(n: number): number {
  return Math.min(
    MAX_ITERATIONS,
    Math.max(80, Math.round(90_000 / Math.max(1, n)))
  );
}

/** Positions by note id, centred on (0, 0). */
export function layoutGraph(
  ids: string[],
  links: LayoutLink[],
  {
    iterations = iterationsFor(ids.length),
    linkLength = 60,
  }: LayoutOptions = {}
): Map<string, Point> {
  const n = ids.length;
  const index = new Map(ids.map((id, i) => [id, i]));
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const vx = new Float64Array(n);
  const vy = new Float64Array(n);
  const spread = 12;
  for (let i = 0; i < n; i++) {
    const r = spread * Math.sqrt(i + 0.5);
    x[i] = r * Math.cos(i * GOLDEN);
    y[i] = r * Math.sin(i * GOLDEN);
  }
  const edges: [number, number][] = [];
  for (const l of links) {
    const a = index.get(l.source);
    const b = index.get(l.target);
    if (a !== undefined && b !== undefined && a !== b) edges.push([a, b]);
  }
  const steps = Math.max(0, Math.min(MAX_ITERATIONS, Math.floor(iterations)));
  const fx = new Float64Array(n);
  const fy = new Float64Array(n);

  for (let step = 0; step < steps; step++) {
    // Cools from 1 toward 0 so the layout settles.
    const alpha = 1 - step / steps;
    fx.fill(0);
    fy.fill(0);

    // Repulsion between notes in the same or a neighbouring grid cell.
    const grid = new Map<number, number[]>();
    const cellX = new Int32Array(n);
    const cellY = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      cellX[i] = Math.floor(x[i] / CUTOFF);
      cellY[i] = Math.floor(y[i] / CUTOFF);
      const key = cellKey(cellX[i], cellY[i]);
      const cell = grid.get(key);
      if (cell) cell.push(i);
      else grid.set(key, [i]);
    }
    for (let i = 0; i < n; i++) {
      const cx = cellX[i];
      const cy = cellY[i];
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          const cell = grid.get(cellKey(gx, gy));
          if (!cell) continue;
          for (const j of cell) {
            if (j <= i) continue;
            let dx = x[i] - x[j];
            let dy = y[i] - y[j];
            let d2 = dx * dx + dy * dy;
            if (d2 > CUTOFF * CUTOFF) continue;
            if (d2 < 0.01) {
              // On top of each other: nudge apart along a fixed direction.
              dx = 0.1 * ((i % 7) - 3) || 0.1;
              dy = 0.1 * ((j % 5) - 2) || 0.1;
              d2 = dx * dx + dy * dy;
            }
            const f = REPEL / d2;
            const d = Math.sqrt(d2);
            const ux = (dx / d) * f;
            const uy = (dy / d) * f;
            fx[i] += ux;
            fy[i] += uy;
            fx[j] -= ux;
            fy[j] -= uy;
          }
        }
      }
    }

    // Springs along links.
    for (const [a, b] of edges) {
      const dx = x[b] - x[a];
      const dy = y[b] - y[a];
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = SPRING * (d - linkLength);
      const ux = (dx / d) * f;
      const uy = (dy / d) * f;
      fx[a] += ux;
      fy[a] += uy;
      fx[b] -= ux;
      fy[b] -= uy;
    }

    for (let i = 0; i < n; i++) {
      fx[i] -= GRAVITY * x[i];
      fy[i] -= GRAVITY * y[i];
      vx[i] = (vx[i] + fx[i] * alpha) * DAMPING;
      vy[i] = (vy[i] + fy[i] * alpha) * DAMPING;
      const speed = Math.hypot(vx[i], vy[i]);
      if (speed > MAX_STEP) {
        vx[i] = (vx[i] / speed) * MAX_STEP;
        vy[i] = (vy[i] / speed) * MAX_STEP;
      }
      x[i] += vx[i];
      y[i] += vy[i];
    }
  }

  const out = new Map<string, Point>();
  ids.forEach((id, i) => out.set(id, { x: x[i], y: y[i] }));
  return out;
}

/** The box around every point, with `pad` on each side. */
export function bounds(
  points: Iterable<Point>,
  pad = 20
): { x: number; y: number; width: number; height: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (minX === Infinity) return { x: -100, y: -100, width: 200, height: 200 };
  return {
    x: minX - pad,
    y: minY - pad,
    width: Math.max(1, maxX - minX) + 2 * pad,
    height: Math.max(1, maxY - minY) + 2 * pad,
  };
}

/** A zoom (`k`) and pan (`tx`, `ty`, in drawing units). */
export interface View {
  k: number;
  tx: number;
  ty: number;
}

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 6;

/**
 * Zooms by `factor` keeping the drawing point under (`px`, `py`) still:
 * a pinch's midpoint or the view's centre for the buttons.
 */
export function zoomAt(
  view: View,
  factor: number,
  px: number,
  py: number
): View {
  const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.k * factor));
  const ratio = k / view.k;
  return {
    k,
    tx: px - (px - view.tx) * ratio,
    ty: py - (py - view.ty) * ratio,
  };
}
