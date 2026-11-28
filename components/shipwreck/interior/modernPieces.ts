import {
  POOL_BASIN_LX,
  POOL_BASIN_LY,
  POOL_COPING_M,
  THEATRE_SEAT_W,
  type ModernPieceId,
} from "@/lib/shipwreck/interior/modernPieces";
import {
  Builder,
  COLOR,
  Layers,
  lin,
  scale,
  TILE,
  type Lamp,
  type P3,
  type RGB,
} from "./pieces";
import { MODERN_TILE as MT } from "./modernTextures";

/**
 * The room kit's modern cruise-ship pieces (the Concordia, 1.18): her glass
 * lifts and their shafts, glass rails, the theatre's seats, curtain and
 * stage lights, the pool's basin and loungers, the cabins' beds, sofa,
 * desk, TV and doors, the balcony's door, rail and chairs, the lobby bar,
 * the kids' club's pirate ship, castle, beanbags, table, shelf and soft
 * play, the emergency lamps and exit signs, and the lamps of her lamp
 * styles (downlights, strips, the atrium chandelier). Low poly with good
 * proportions and bright, friendly colour, as `pieces.ts`'s.
 *
 * Every piece is built in its own frame as `pieces.ts`'s are (x out of the
 * wall it stands on or the way it faces, y to its left, z up, the origin
 * on the floor, a wall's foot or the ceiling: `MODERN_PIECE_MOUNT` in
 * lib's modernPieces.ts) and writes into a zone's layers; a blocking piece
 * is centred on its `MODERN_PIECE_FOOTPRINT`, back to −x. Two things are
 * new beside the four layers:
 *
 * - **See-through glass** (`ModernLayers.pane`): a fifth builder, both
 *   faces of every pane, tagged `MODERN_TILE.pane`, for the glass finish's
 *   tinted see-through material (the lift cars, rails, balcony doors).
 * - **Emergency glass** (`MODERN_TILE.emergency` in `glass`): lamps and
 *   exit signs that glow on the emergency supply whatever the room's lamps
 *   (`withModern` in modernTextures.ts), HDR so bloom catches them.
 *
 * Detail tiles on faces are `MODERN_TILE`s (veneer, marble, teak, pool
 * tile, stage wood, theatre velvet...), drawn once `withModern` is in.
 */

/** A zone's layers and its see-through panes. */
export class ModernLayers extends Layers {
  readonly pane = new Builder();

  constructor() {
    super();
    this.pane.tileId = MT.pane;
  }

  override get all(): readonly Builder[] {
    return [this.shell, this.wood, this.metal, this.glass, this.pane];
  }
}

/** Her colours, picked in sRGB (linear as the vertex colours are). */
export const MODERN_COLOR = {
  veneer: lin(0.78, 0.6, 0.42),
  veneerDark: lin(0.46, 0.3, 0.18),
  cream: lin(0.94, 0.89, 0.78),
  white: lin(0.93, 0.93, 0.9),
  marble: lin(0.93, 0.91, 0.87),
  granite: lin(0.34, 0.33, 0.33),
  chrome: lin(0.8, 0.82, 0.85),
  steel: lin(0.6, 0.62, 0.64),
  steelDark: lin(0.24, 0.25, 0.27),
  black: lin(0.07, 0.07, 0.08),
  gold: lin(0.88, 0.68, 0.3),
  theatre: lin(0.62, 0.07, 0.1),
  theatreDark: lin(0.36, 0.04, 0.06),
  seatWood: lin(0.3, 0.17, 0.1),
  carpetDark: lin(0.2, 0.08, 0.1),
  teak: lin(0.66, 0.44, 0.24),
  stageWood: lin(0.36, 0.24, 0.15),
  poolBlue: lin(0.36, 0.72, 0.86),
  poolDeep: lin(0.12, 0.4, 0.7),
  navy: lin(0.16, 0.22, 0.4),
  navyDark: lin(0.1, 0.13, 0.24),
  fabricGrey: lin(0.66, 0.66, 0.66),
  teal: lin(0.18, 0.52, 0.58),
  sling: lin(0.32, 0.31, 0.3),
  birch: lin(0.88, 0.8, 0.64),
  /** Costa's yellow and blue, and the kids' bright colours. */
  yellow: lin(1.0, 0.8, 0.12),
  blue: lin(0.14, 0.44, 0.92),
  red: lin(0.92, 0.2, 0.16),
  green: lin(0.26, 0.74, 0.3),
  purple: lin(0.6, 0.36, 0.86),
  pink: lin(0.98, 0.52, 0.72),
  orange: lin(1.0, 0.52, 0.12),
  /** Lamp glass (times its glow: over 1 so bloom catches it). */
  lamp: lin(1.0, 0.9, 0.72),
  crystal: lin(0.96, 0.95, 1.0),
  onyx: lin(1.0, 0.76, 0.42),
  screen: lin(0.16, 0.34, 0.6),
  /** Emergency glass: the floor strips, the ceiling strips, exit green. */
  emergencyLow: lin(0.55, 1.0, 0.35),
  emergencyHigh: lin(1.0, 0.97, 0.9),
  exitGreen: lin(0.08, 0.82, 0.3),
  /** See-through glass, faintly green. */
  glass: lin(0.62, 0.78, 0.78),
} as const;

const C = MODERN_COLOR;

// --- Helpers ---------------------------------------------------------------------

/** Runs `fn` with the layers placed at origin/yaw, then resets them. */
function placed<T>(L: Layers, origin: P3, yaw: number, fn: () => T): T {
  L.place(origin, yaw);
  try {
    return fn();
  } finally {
    L.place(null);
  }
}

/** Runs `fn` with a builder's detail tile set, then puts it back. */
function tiled(b: Builder, tile: number, fn: () => void): void {
  const t = b.tileId;
  b.tileId = tile;
  fn();
  b.tileId = t;
}

/** Glass that glows (HDR): `glow` times its colour; `tile` its kind. */
function glowing(
  L: Layers,
  glow: number,
  fn: (g: Builder) => void,
  tile: number = TILE.none
): void {
  const g = L.glass;
  const was = g.glowV;
  const t = g.tileId;
  g.glowV = glow;
  g.tileId = tile;
  fn(g);
  g.glowV = was;
  g.tileId = t;
}

/** A see-through pane a→b→c→d, both faces. */
function pane(
  L: ModernLayers,
  a: P3,
  b: P3,
  c: P3,
  d: P3,
  color: RGB = C.glass
): void {
  L.pane.quad(a, b, c, d, color);
  L.pane.quad(d, c, b, a, color);
}

/** A local point placed (pure, without a builder). */
function pt(at: P3, yaw: number, p: P3): P3 {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [
    at[0] + p[0] * c - p[1] * s,
    at[1] + p[0] * s + p[1] * c,
    at[2] + p[2],
  ];
}

/** A flat face, its front +x, in the y–z plane: a stroke from p to q. */
function stroke(
  b: Builder,
  x: number,
  p: readonly [number, number],
  q: readonly [number, number],
  w: number,
  color: RGB
): void {
  const dy = q[0] - p[0];
  const dz = q[1] - p[1];
  const l = Math.hypot(dy, dz) || 1;
  const ny = (-dz / l) * (w / 2);
  const nz = (dy / l) * (w / 2);
  b.quad(
    [x, p[0] - ny, p[1] - nz],
    [x, q[0] - ny, q[1] - nz],
    [x, q[0] + ny, q[1] + nz],
    [x, p[0] + ny, p[1] + nz],
    color
  );
}

/** A flat rectangle facing +x at x, y0..y1, z0..z1. */
function faceX(
  b: Builder,
  x: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  color: RGB
): void {
  b.quad([x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1], color);
}

// --- The glass lifts ---------------------------------------------------------------

/** The glass car's plan and height (m): `lift-a`'s 2.2 × 2.2 m. */
export const LIFT_CAR_LX = 2.2;
export const LIFT_CAR_LY = 2.2;
export const LIFT_CAR_H = 2.4;

/**
 * A glass lift car (drawn by the lift, moved by matrix): a granite floor,
 * a white roof with four downlights, chrome posts and rims, glass on three
 * sides and two glass door leaves slid back from a 1.2 m opening at its
 * front (+x), a chrome handrail, a floor display over the door, and under
 * it a chrome cone ringed with lights (the atrium sees it from below).
 * Origin: the car floor's middle.
 */
export function glassLiftCar(
  L: ModernLayers,
  at: P3,
  yaw: number,
  lx = LIFT_CAR_LX,
  ly = LIFT_CAR_LY,
  h = LIFT_CAR_H
): Lamp[] {
  const X = lx / 2;
  const Y = ly / 2;
  placed(L, at, yaw, () => {
    const s = L.shell;
    const m = L.metal;
    tiled(s, MT.marble, () => s.box([0, 0, -0.07], lx, ly, 0.16, C.granite));
    s.box([0, 0, h + 0.07], lx, ly, 0.14, C.white);
    m.box([-X * 0.4, 0, h + 0.24], 0.6, 0.6, 0.2, C.steelDark, {
      bottom: true,
    });
    // The cone under it, and its ring of lights.
    m.cyl([0, 0, -0.5], 0.22, Math.min(X, Y) * 0.92, 0.34, 8, C.chrome);
    glowing(L, 2.6, (g) => {
      for (let i = 0; i < 8; i += 1) {
        const a = ((i + 0.5) / 8) * Math.PI * 2;
        g.ball([Math.cos(a) * 0.62, Math.sin(a) * 0.62, -0.32], 0.035, C.lamp);
      }
      for (const x of [-0.5, 0.5])
        for (const y of [-0.5, 0.5])
          g.cyl([x, y, h - 0.012], 0.07, 0.07, 0.012, 8, C.lamp);
    });
    // Posts and rims.
    for (const x of [-X + 0.035, X - 0.035])
      for (const y of [-Y + 0.035, Y - 0.035])
        m.box([x, y, h / 2], 0.07, 0.07, h, C.chrome, {
          top: true,
          bottom: true,
        });
    for (const z of [0.05, h - 0.04]) {
      m.box([-X + 0.02, 0, z], 0.04, ly - 0.14, 0.09, C.chrome);
      for (const y of [-Y + 0.02, Y - 0.02])
        m.box([0, y, z], lx - 0.14, 0.04, 0.09, C.chrome);
    }
    m.box([X - 0.02, 0, h - 0.04], 0.04, ly - 0.14, 0.09, C.chrome);
    // Glass: back and sides, and the door leaves slid back either side.
    const z0 = 0.1;
    const z1 = h - 0.09;
    const xb = -X + 0.03;
    pane(L, [xb, -Y, z0], [xb, Y, z0], [xb, Y, z1], [xb, -Y, z1]);
    for (const y of [-Y + 0.03, Y - 0.03])
      pane(L, [-X, y, z0], [X, y, z0], [X, y, z1], [-X, y, z1]);
    const xf = X - 0.03;
    for (const sgn of [-1, 1]) {
      const ya = sgn * (Y - 0.04);
      const yb = sgn * 0.6;
      pane(L, [xf, ya, z0], [xf, yb, z0], [xf, yb, z1], [xf, ya, z1]);
      m.box([xf, yb, h / 2], 0.05, 0.04, h - 0.1, C.chrome, {
        bottom: true,
      });
    }
    // The handrail round the back and sides.
    const r = 0.9;
    const hx = -X + 0.1;
    m.tube([hx, -Y + 0.1, r], [hx, Y - 0.1, r], 0.022, 6, C.chrome);
    for (const y of [-Y + 0.1, Y - 0.1])
      m.tube([hx, y, r], [X - 0.2, y, r], 0.022, 6, C.chrome, true);
    // The floor display over the door, the buttons beside it.
    glowing(L, 1.8, (g) => {
      g.box([X - 0.07, 0, h - 0.2], 0.02, 0.36, 0.1, C.onyx, { back: true });
      g.ball([X - 0.08, -0.82, 1.18], 0.018, C.onyx);
      g.ball([X - 0.08, -0.82, 1.08], 0.018, C.onyx);
    });
    m.box([X - 0.06, -0.82, 1.13], 0.02, 0.1, 0.28, C.steel, { back: true });
  });
  return [{ p: pt(at, yaw, [0, 0, h - 0.25]), intensity: 1.1, radius: 2.2 }];
}

/** A storey of the lift shaft: its default height (m). */
export const LIFT_STOREY_M = 3.0;

/**
 * A storey of a glass lift shaft round a car's plan (2.4 m square with
 * its frame): white steel corner columns, glass on the back and sides with
 * a transom, guide rails, the deck's slab edge as a band at its foot
 * (where the car passes each deck), and at its front (+x) the landing
 * door: jambs and a header with the floor display, the glass leaves slid
 * back from a 1.2 m opening, a call button. Origin: the shaft's middle at
 * the storey's floor; `h` the storey's height.
 */
export function liftShaft(
  L: ModernLayers,
  at: P3,
  yaw: number,
  lx = 2.4,
  ly = 2.4,
  h = LIFT_STOREY_M
): Lamp[] {
  const X = lx / 2;
  const Y = ly / 2;
  placed(L, at, yaw, () => {
    const s = L.shell;
    const m = L.metal;
    for (const x of [-X, X])
      for (const y of [-Y, Y])
        m.box([x, y, h / 2], 0.12, 0.12, h, C.white, { bottom: true });
    // The slab edge and its chrome line.
    s.box([-X, 0, -0.15], 0.12, ly - 0.12, 0.3, C.cream, { top: true });
    for (const y of [-Y, Y])
      s.box([0, y, -0.15], lx - 0.12, 0.12, 0.3, C.cream, { top: true });
    m.box([X, 0, -0.15], 0.12, ly - 0.12, 0.3, C.steel, { top: true });
    for (const y of [-Y - 0.062, Y + 0.062])
      m.box([0, y, -0.04], lx, 0.004, 0.03, C.chrome, { back: true });
    // Guide rails and the transom.
    for (const y of [-0.62, 0.62])
      m.box([-X + 0.1, y, h / 2], 0.06, 0.08, h, C.steelDark, {
        bottom: true,
      });
    const zt = h - 0.3;
    m.box([-X, 0, zt], 0.06, ly - 0.12, 0.06, C.white);
    for (const y of [-Y, Y]) m.box([0, y, zt], lx - 0.12, 0.06, 0.06, C.white);
    // Glass, back and sides, under the transom and over it.
    for (const [za, zb] of [
      [0.0, zt - 0.03],
      [zt + 0.03, h],
    ] as const) {
      pane(L, [-X, -Y, za], [-X, Y, za], [-X, Y, zb], [-X, -Y, zb]);
      for (const y of [-Y, Y])
        pane(L, [-X, y, za], [X, y, za], [X, y, zb], [-X, y, zb]);
    }
    // The landing door: jambs, header, the leaves slid back.
    const D = 0.6;
    const HD = 2.15;
    for (const sg of [-1, 1])
      m.box([X, sg * (D + 0.04), HD / 2], 0.14, 0.08, HD, C.steel, {
        bottom: true,
      });
    m.box([X, 0, (HD + h) / 2], 0.1, ly - 0.12, h - HD, C.white, {
      bottom: false,
    });
    for (const sg of [-1, 1]) {
      const ya = sg * (D + 0.08);
      const yb = sg * (Y - 0.06);
      pane(L, [X, ya, 0], [X, yb, 0], [X, yb, HD], [X, ya, HD]);
    }
    glowing(L, 1.8, (g) => {
      g.box([X + 0.055, 0, HD + 0.2], 0.012, 0.4, 0.12, C.onyx, {
        back: true,
      });
      g.ball([X + 0.09, -(D + 0.04), 1.1], 0.02, C.onyx);
    });
    m.box([X + 0.07, -(D + 0.04), 1.1], 0.01, 0.06, 0.16, C.steel, {
      back: true,
    });
  });
  return [];
}

// --- Rails -----------------------------------------------------------------------

export interface RailStyle {
  /** The handrail's top over the floor line (m). */
  height: number;
  /** Chrome tube, or a wide teak cap (a balcony's). */
  top: "chrome" | "teak";
  /** Posts at most this far apart (m). */
  bay: number;
}

export const GLASS_RAIL: RailStyle = { height: 1.05, top: "chrome", bay: 1.5 };
export const BALCONY_RAIL: RailStyle = { height: 1.1, top: "teak", bay: 1.2 };

/**
 * A glass balustrade from a to b (local or ship points on the floor line,
 * level or sloping), set 5 cm in to the left of a → b: a chrome shoe, a
 * glass pane per bay between posts, and a chrome or teak handrail.
 */
export function glassRailRun(
  L: ModernLayers,
  a: P3,
  b: P3,
  style: RailStyle = GLASS_RAIL
): void {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (!(len > 1e-3)) return;
  const nx = (-dy / len) * 0.05;
  const ny = (dx / len) * 0.05;
  const A: P3 = [a[0] + nx, a[1] + ny, a[2]];
  const B: P3 = [b[0] + nx, b[1] + ny, b[2]];
  const at = (t: number, z: number): P3 => [
    A[0] + (B[0] - A[0]) * t,
    A[1] + (B[1] - A[1]) * t,
    A[2] + (B[2] - A[2]) * t + z,
  ];
  const H = style.height;
  const m = L.metal;
  const bays = Math.max(1, Math.ceil(len / style.bay));
  for (let k = 0; k <= bays; k += 1) {
    const t = k / bays;
    m.beam(at(t, 0), at(t, H - 0.03), 0.04, 0.04, C.chrome);
  }
  for (let k = 0; k < bays; k += 1) {
    const t0 = k / bays + 0.01;
    const t1 = (k + 1) / bays - 0.01;
    pane(L, at(t0, 0.08), at(t1, 0.08), at(t1, H - 0.08), at(t0, H - 0.08));
  }
  m.beam(at(0, 0.04), at(1, 0.04), 0.05, 0.08, C.steel);
  if (style.top === "chrome")
    m.tube(at(0, H), at(1, H), 0.025, 6, C.chrome, true);
  else
    tiled(L.wood, MT.teak, () =>
      L.wood.beam(at(0, H), at(1, H), 0.12, 0.05, C.teak)
    );
}

/**
 * A glass rail `length` long (default 2 m) along a room edge: the
 * `glass-rail` piece. Origin: the edge's middle; x into the room.
 */
export function glassRail(
  L: ModernLayers,
  at: P3,
  yaw: number,
  length = 2
): Lamp[] {
  placed(L, at, yaw, () =>
    glassRailRun(L, [0, length / 2, 0], [0, -length / 2, 0])
  );
  return [];
}

/**
 * A balcony's rail (default 3.6 m, a stateroom's width): glass in steel
 * posts under a teak cap, 1.1 m. Origin: its middle; x into the balcony.
 */
export function balconyRail(
  L: ModernLayers,
  at: P3,
  yaw: number,
  length = 3.6
): Lamp[] {
  placed(L, at, yaw, () =>
    glassRailRun(L, [0, length / 2, 0], [0, -length / 2, 0], BALCONY_RAIL)
  );
  return [];
}

/**
 * The atrium stair's dressing (the flight's treads are the kit's): a
 * glass rail down each side and a white stringer under it. `top` and
 * `bottom` are the flight's centre line ends on its floor line (as the
 * room's ramp), `width` its width.
 */
export function atriumStair(
  L: ModernLayers,
  top: P3,
  bottom: P3,
  width: number
): Lamp[] {
  const dx = bottom[0] - top[0];
  const dy = bottom[1] - top[1];
  const len = Math.hypot(dx, dy);
  if (!(len > 1e-3)) return [];
  // The left of top → bottom.
  const lx = (-dy / len) * (width / 2);
  const ly = (dx / len) * (width / 2);
  const side = (p: P3, k: number): P3 => [p[0] + lx * k, p[1] + ly * k, p[2]];
  // Each rail's run has the flight on its left.
  glassRailRun(L, side(bottom, 1), side(top, 1));
  glassRailRun(L, side(top, -1), side(bottom, -1));
  tiled(L.shell, MT.marble, () => {
    for (const k of [1, -1]) {
      const p = side(top, k * 1.02);
      const q = side(bottom, k * 1.02);
      L.shell.beam(
        [p[0], p[1], p[2] - 0.12],
        [q[0], q[1], q[2] - 0.12],
        0.08,
        0.36,
        C.white
      );
    }
  });
  return [];
}

// --- The theatre --------------------------------------------------------------------

/** A theatre seat's width (m), lib's (its footprint: `seatRowFootprint`). */
export const SEAT_W = THEATRE_SEAT_W;

/**
 * A row of theatre seats (default ten, 5.5 m) facing +x: red velvet seats
 * and tilted backs, dark wood standards between them, a low velvet back
 * along the row, on a carpeted plinth (it hides the rake under the
 * row), and a small aisle light low on each end standard. Origin: the
 * row's middle on the floor.
 */
export function theatreSeatRow(
  L: ModernLayers,
  at: P3,
  yaw: number,
  seats = 10
): Lamp[] {
  const ly = seats * SEAT_W;
  const Y = ly / 2;
  placed(L, at, yaw, () => {
    const s = L.shell;
    s.box([0, 0, -0.06], 0.78, ly - 0.02, 0.14, C.carpetDark, {
      bottom: true,
    });
    tiled(s, MT.theatre, () => {
      // A low back along the row; each seat its own tilted back over it.
      s.box([-0.33, 0, 0.27], 0.1, ly - 0.04, 0.46, C.theatreDark, {
        bottom: true,
      });
      for (let k = 0; k < seats; k += 1) {
        const y = -Y + SEAT_W * (k + 0.5);
        s.box([0.02, y, 0.42], 0.46, SEAT_W - 0.06, 0.11, C.theatre, {
          back: true,
          bottom: true,
        });
        s.beam(
          [-0.27, y, 0.46],
          [-0.34, y, 1.02],
          SEAT_W - 0.07,
          0.09,
          C.theatre
        );
      }
    });
    const w = L.wood;
    tiled(w, TILE.grain, () => {
      for (let k = 0; k <= seats; k += 1) {
        const y = Math.max(-Y + 0.03, Math.min(Y - 0.03, -Y + SEAT_W * k));
        w.box([-0.05, y, 0.33], 0.52, 0.05, 0.66, C.seatWood, {
          bottom: true,
        });
      }
    });
    glowing(L, 2.2, (g) => {
      for (const y of [-Y - 0.002, Y + 0.002])
        g.box([0.12, y, 0.12], 0.08, 0.006, 0.04, C.onyx);
    });
  });
  return [];
}

/**
 * The stage's curtain (default 14 m wide, 6 m high), open: a red velvet
 * curtain each side in deep pleats, gathered by gold tiebacks, a pelmet
 * with a gold fringe across the top, framed by the proscenium (red
 * pillars and a header, gold lines). Faces +x, the stalls. Origin: the
 * stage floor's middle on the curtain line.
 */
export function stageCurtain(
  L: ModernLayers,
  at: P3,
  yaw: number,
  width = 14,
  height = 6
): Lamp[] {
  const Y = width / 2;
  placed(L, at, yaw, () => {
    const s = L.shell;
    const m = L.metal;
    tiled(s, MT.theatre, () => {
      for (const sg of [-1, 1])
        s.box(
          [0.3, sg * (Y + 0.4), (height + 0.8) / 2],
          0.5,
          0.8,
          height + 0.8,
          C.theatreDark,
          { back: true, bottom: true }
        );
      s.box([0.3, 0, height + 0.55], 0.5, width + 1.6, 0.5, C.theatreDark, {
        back: true,
      });
      // The pelmet.
      s.box([0.02, 0, height - 0.3], 0.12, width, 0.6, C.theatre, {
        back: true,
      });
      // The curtains: pleats from the outer edge in, gathered at a
      // tieback, hanging to the floor; crests lit, folds shaded.
      const SPAN = 3.0;
      const F = 12;
      const tie = 1.25;
      const rows: [number, number, number][] = [
        // z, how far in the pleats reach (of SPAN), pleat depth.
        [0.02, 0.72, 0.16],
        [tie, 0.42, 0.08],
        [height - 0.55, 1.0, 0.2],
      ];
      for (const sg of [-1, 1]) {
        for (let r = 0; r < rows.length - 1; r += 1) {
          const [za, ia, da] = rows[r];
          const [zb, ib, db] = rows[r + 1];
          for (let i = 0; i < F; i += 1) {
            const P = (
              k: number,
              z: number,
              reach: number,
              dep: number
            ): P3 => [
              k % 2 === 0 ? -dep / 2 : dep / 2,
              sg * (Y - (SPAN * reach * k) / F),
              z,
            ];
            const a = P(i, za, ia, da);
            const b = P(i + 1, za, ia, da);
            const c = P(i + 1, zb, ib, db);
            const d = P(i, zb, ib, db);
            const ca = i % 2 === 0 ? scale(C.theatre, 0.7) : C.theatre;
            const cb = i % 2 === 0 ? C.theatre : scale(C.theatre, 0.7);
            // Both faces (the stage sees their backs).
            s.quad(a, b, c, d, ca, cb, cb, ca);
            s.quad(b, a, d, c, cb, ca, ca, cb);
          }
        }
      }
    });
    // Gold: the proscenium's lines, the fringe, the tiebacks.
    for (const sg of [-1, 1])
      m.box([0.56, sg * (Y + 0.04), height / 2], 0.03, 0.08, height, C.gold, {
        back: true,
        bottom: true,
      });
    m.box([0.56, 0, height + 0.02], 0.03, width + 0.16, 0.08, C.gold, {
      back: true,
    });
    m.box([0.09, 0, height - 0.63], 0.02, width, 0.07, C.gold, { back: true });
    for (const sg of [-1, 1]) {
      const y0 = sg * Y;
      const y1 = sg * (Y - 3.0 * 0.42);
      m.beam([0.1, y0, 1.25], [0.1, y1, 1.25], 0.05, 0.06, C.gold);
      m.ball([0.12, y1, 1.2], 0.06, C.gold);
    }
  });
  return [];
}

/**
 * The stage lights (default a 10 m bar): a black truss hung on rods from
 * the ceiling with six lanterns, each a coloured lens (red, amber, blue,
 * white, magenta, green) aimed down and back onto the stage (−x). Origin:
 * the ceiling point over the bar's middle. Its lamps light the stage.
 */
export function stageLights(
  L: ModernLayers,
  at: P3,
  yaw: number,
  width = 10
): Lamp[] {
  const Y = width / 2;
  const drop = 0.6;
  const LENS = [
    lin(1.0, 0.25, 0.2),
    lin(1.0, 0.7, 0.3),
    lin(0.3, 0.5, 1.0),
    lin(1.0, 0.95, 0.85),
    lin(1.0, 0.35, 0.85),
    lin(0.35, 1.0, 0.45),
  ];
  placed(L, at, yaw, () => {
    const m = L.metal;
    for (const y of [-Y + 0.8, Y - 0.8])
      m.beam([0, y, 0], [0, y, -drop], 0.025, 0.025, C.black, false);
    for (const z of [-drop, -drop - 0.28])
      m.beam([0, -Y, z], [0, Y, z], 0.05, 0.05, C.steelDark);
    const n = Math.max(2, Math.round(width / 0.7));
    for (let i = 0; i < n; i += 1) {
      const ya = -Y + (width * i) / n;
      const yb = -Y + (width * (i + 1)) / n;
      m.beam(
        [0, ya, i % 2 ? -drop : -drop - 0.28],
        [0, yb, i % 2 ? -drop - 0.28 : -drop],
        0.025,
        0.025,
        C.steelDark,
        false
      );
    }
    const dir: P3 = [-0.45, 0, -0.89];
    LENS.forEach((lens, i) => {
      const y = -Y + 0.6 + ((width - 1.2) * i) / (LENS.length - 1);
      const p: P3 = [0.05, y, -drop - 0.4];
      const q: P3 = [p[0] + dir[0] * 0.32, y, p[2] + dir[2] * 0.32];
      m.beam([0, y, -drop - 0.3], [0, y, -drop - 0.4], 0.03, 0.03, C.black);
      m.tube(p, q, 0.1, 8, C.black, true);
      glowing(L, 3.0, (g) =>
        g.tube(
          [q[0] + dir[0] * 0.005, y, q[2] + dir[2] * 0.005],
          [q[0] + dir[0] * 0.012, y, q[2] + dir[2] * 0.012],
          0.08,
          8,
          lens,
          true
        )
      );
    });
  });
  return [-Y / 2, 0, Y / 2].map((y) => ({
    p: pt(at, yaw, [-1.6, y, -drop - 1.8]),
    intensity: 1.3,
    radius: 3.6,
  }));
}

// --- The pool ---------------------------------------------------------------------

/** The pool's basin (m): its water's plan and depth. */
export const POOL_LX = POOL_BASIN_LX;
export const POOL_LY = POOL_BASIN_LY;
export const POOL_DEPTH_M = 1.4;
/** The coping round the basin (m): walkable, outside its footprint. */
const COPING_M = POOL_COPING_M;

/**
 * The pool: a basin tiled in pool blue (a deep blue band at the waterline,
 * a racing line on its floor), four underwater lights, a white stone
 * coping round it and a chrome ladder at one corner. The water is the
 * kit's. Origin: the basin's middle at the deck.
 */
export function poolEdge(
  L: ModernLayers,
  at: P3,
  yaw: number,
  lx = POOL_LX,
  ly = POOL_LY,
  depth = POOL_DEPTH_M
): Lamp[] {
  const X = lx / 2;
  const Y = ly / 2;
  const D = depth;
  placed(L, at, yaw, () => {
    const s = L.shell;
    tiled(s, MT.poolTile, () => {
      // The walls, facing in, in 1.5 m bays (points for the light).
      const nx = Math.ceil(lx / 1.5);
      const ny = Math.ceil(ly / 1.5);
      for (let i = 0; i < nx; i += 1) {
        const x0 = -X + (lx * i) / nx;
        const x1 = -X + (lx * (i + 1)) / nx;
        // +y wall faces −y; −y wall faces +y.
        s.quad([x0, Y, -D], [x1, Y, -D], [x1, Y, 0], [x0, Y, 0], C.poolBlue);
        s.quad(
          [x1, -Y, -D],
          [x0, -Y, -D],
          [x0, -Y, 0],
          [x1, -Y, 0],
          C.poolBlue
        );
        s.quad(
          [x0, Y - 0.002, -0.28],
          [x1, Y - 0.002, -0.28],
          [x1, Y - 0.002, -0.06],
          [x0, Y - 0.002, -0.06],
          C.poolDeep
        );
        s.quad(
          [x1, -Y + 0.002, -0.28],
          [x0, -Y + 0.002, -0.28],
          [x0, -Y + 0.002, -0.06],
          [x1, -Y + 0.002, -0.06],
          C.poolDeep
        );
        for (let j = 0; j < ny; j += 1) {
          const y0 = -Y + (ly * j) / ny;
          const y1 = -Y + (ly * (j + 1)) / ny;
          s.quad(
            [x0, y0, -D],
            [x1, y0, -D],
            [x1, y1, -D],
            [x0, y1, -D],
            scale(C.poolBlue, 1.08)
          );
        }
      }
      for (let j = 0; j < ny; j += 1) {
        const y0 = -Y + (ly * j) / ny;
        const y1 = -Y + (ly * (j + 1)) / ny;
        s.quad([X, y1, -D], [X, y0, -D], [X, y0, 0], [X, y1, 0], C.poolBlue);
        s.quad(
          [-X, y0, -D],
          [-X, y1, -D],
          [-X, y1, 0],
          [-X, y0, 0],
          C.poolBlue
        );
        s.quad(
          [X - 0.002, y1, -0.28],
          [X - 0.002, y0, -0.28],
          [X - 0.002, y0, -0.06],
          [X - 0.002, y1, -0.06],
          C.poolDeep
        );
        s.quad(
          [-X + 0.002, y0, -0.28],
          [-X + 0.002, y1, -0.28],
          [-X + 0.002, y1, -0.06],
          [-X + 0.002, y0, -0.06],
          C.poolDeep
        );
      }
      // The racing line, T at each end.
      const z = -D + 0.004;
      s.quad(
        [-X + 0.9, -0.12, z],
        [X - 0.9, -0.12, z],
        [X - 0.9, 0.12, z],
        [-X + 0.9, 0.12, z],
        C.poolDeep
      );
      for (const x of [-X + 0.9, X - 0.9])
        s.quad(
          [x - 0.12, -0.5, z],
          [x + 0.12, -0.5, z],
          [x + 0.12, 0.5, z],
          [x - 0.12, 0.5, z],
          C.poolDeep
        );
    });
    // The coping.
    tiled(s, MT.marble, () => {
      for (const sg of [-1, 1]) {
        s.box(
          [0, sg * (Y + COPING_M / 2), 0.015],
          lx + 2 * COPING_M,
          COPING_M,
          0.06,
          C.marble,
          {
            bottom: true,
          }
        );
        s.box(
          [sg * (X + COPING_M / 2), 0, 0.015],
          COPING_M,
          ly,
          0.06,
          C.marble,
          {
            bottom: true,
          }
        );
      }
    });
    // Underwater lights.
    glowing(L, 2.2, (g) => {
      for (const x of [-X / 2, X / 2])
        for (const sg of [-1, 1])
          g.box([x, sg * (Y - 0.01), -0.55], 0.26, 0.02, 0.16, C.crystal);
    });
    // The ladder at the +x, −y corner.
    const m = L.metal;
    const ly0 = -Y + 0.14;
    const ly1 = -Y - 0.22;
    for (const x of [X - 1.15, X - 0.65]) {
      m.tube([x, ly0, -0.95], [x, ly0, 0.75], 0.022, 6, C.chrome);
      m.tube([x, ly0, 0.75], [x, ly1, 0.75], 0.022, 6, C.chrome);
      m.tube([x, ly1, 0.75], [x, ly1, 0.04], 0.022, 6, C.chrome, true);
    }
    for (const z of [-0.8, -0.5, -0.2])
      m.box([X - 0.9, ly0 - 0.02, z], 0.5, 0.06, 0.03, C.chrome);
  });
  return [];
}

/**
 * A sun lounger (1.95 × 0.7): a white frame on four legs, a blue cushion
 * with its back raised at −x, a rolled pillow, a striped towel at the foot.
 */
export function lounger(L: ModernLayers, at: P3, yaw: number): Lamp[] {
  placed(L, at, yaw, () => {
    const m = L.metal;
    const s = L.shell;
    for (const y of [-0.3, 0.3]) {
      m.beam([-0.3, y, 0.32], [0.95, y, 0.32], 0.04, 0.05, C.white);
      m.beam([-0.32, y, 0.36], [-0.88, y, 0.9], 0.03, 0.04, C.white);
      for (const x of [-0.85, 0.9])
        m.box([x, y, 0.15], 0.04, 0.04, 0.3, C.white, { bottom: true });
    }
    m.beam([-0.88, -0.3, 0.9], [-0.88, 0.3, 0.9], 0.03, 0.03, C.white);
    s.box([0.32, 0, 0.385], 1.24, 0.62, 0.09, C.blue, { bottom: true });
    s.beam([-0.3, 0, 0.42], [-0.84, 0, 0.94], 0.62, 0.08, C.blue);
    s.tube([-0.8, -0.24, 0.96], [-0.8, 0.24, 0.96], 0.07, 6, C.white, true);
    s.box([0.72, 0, 0.455], 0.32, 0.6, 0.05, C.yellow, { bottom: true });
    for (const x of [0.64, 0.8])
      s.box([x, 0, 0.482], 0.04, 0.602, 0.004, C.white, { bottom: true });
  });
  return [];
}

// --- Cabins ------------------------------------------------------------------------

/**
 * A cabin bed (a twin, 2.0 × 0.9; two side by side make the stateroom's
 * queen): a navy upholstered headboard at −x, a grey divan, a white duvet
 * turned down, a pillow, a yellow cushion and a navy runner across the foot.
 */
export function cabinBed(L: ModernLayers, at: P3, yaw: number): Lamp[] {
  placed(L, at, yaw, () => {
    const s = L.shell;
    s.box([-0.97, 0, 0.62], 0.06, 0.9, 1.1, C.navy, {
      back: true,
      bottom: true,
    });
    for (const z of [0.55, 0.85])
      s.box([-0.938, 0, z], 0.006, 0.86, 0.02, C.navyDark, { back: true });
    s.box([0.03, 0, 0.17], 1.92, 0.86, 0.3, C.fabricGrey, { bottom: true });
    s.box([0.03, 0, 0.39], 1.9, 0.84, 0.14, C.white, { bottom: true });
    s.box([0.24, 0, 0.5], 1.46, 0.9, 0.1, scale(C.white, 0.97), {
      bottom: true,
    });
    s.box([-0.46, 0, 0.53], 0.1, 0.9, 0.05, C.white, { bottom: true });
    s.box([0.68, 0, 0.56], 0.42, 0.9, 0.025, C.navy, { bottom: true });
    s.box([0.68, 0, 0.574], 0.08, 0.902, 0.006, C.yellow, { bottom: true });
    s.box([-0.72, 0, 0.53], 0.34, 0.68, 0.14, C.white, { bottom: true });
    s.box([-0.58, 0, 0.6], 0.12, 0.4, 0.22, C.yellow, { bottom: true });
  });
  return [];
}

/**
 * A cabin sofa (0.85 × 1.8): teal, square modern arms and back, two seat
 * cushions, a yellow and a white throw cushion, chrome feet.
 */
export function cabinSofa(L: ModernLayers, at: P3, yaw: number): Lamp[] {
  placed(L, at, yaw, () => {
    const s = L.shell;
    for (const x of [-0.33, 0.33])
      for (const y of [-0.8, 0.8])
        L.metal.box([x, y, 0.04], 0.04, 0.04, 0.08, C.chrome, {
          bottom: true,
        });
    s.box([0.02, 0, 0.2], 0.8, 1.76, 0.24, scale(C.teal, 0.8), {
      bottom: true,
    });
    for (const y of [-0.41, 0.41])
      s.box([0.08, y, 0.38], 0.66, 0.8, 0.12, C.teal, { bottom: true });
    s.box([-0.33, 0, 0.55], 0.18, 1.76, 0.6, scale(C.teal, 0.92), {
      bottom: true,
    });
    for (const y of [-0.82, 0.82])
      s.box([0.0, y, 0.42], 0.84, 0.14, 0.38, scale(C.teal, 0.96), {
        bottom: true,
      });
    s.box([-0.18, -0.5, 0.6], 0.12, 0.36, 0.32, C.yellow, { bottom: true });
    s.box([-0.18, 0.5, 0.6], 0.12, 0.36, 0.32, C.white, { bottom: true });
  });
  return [];
}

/**
 * A cabin desk (0.5 × 1.2): a veneer top on a drawer pedestal at −y, a
 * side panel and modesty panel, a mirror on the wall over it, a lamp, a
 * navy stool tucked under. Its lamp lights the desk.
 */
export function desk(L: ModernLayers, at: P3, yaw: number): Lamp[] {
  placed(L, at, yaw, () => {
    const w = L.wood;
    tiled(w, MT.veneer, () => {
      w.box([0, 0, 0.74], 0.5, 1.2, 0.04, C.veneer);
      w.box([0, -0.38, 0.36], 0.46, 0.42, 0.68, C.veneer, { bottom: true });
      w.box([0, 0.57, 0.36], 0.46, 0.04, 0.68, C.veneer, { bottom: true });
      w.box([-0.22, 0.1, 0.45], 0.03, 0.9, 0.5, scale(C.veneer, 0.85), {
        bottom: true,
      });
    });
    for (const z of [0.2, 0.42, 0.62])
      L.metal.box([0.235, -0.38, z], 0.012, 0.14, 0.02, C.chrome, {
        back: true,
      });
    L.shell.box([-0.24, 0.1, 1.35], 0.012, 0.8, 0.7, COLOR.mirror, {
      back: true,
    });
    L.shell.cyl([0.06, 0.12, 0], 0.17, 0.17, 0.45, 8, C.navy);
    L.metal.cyl([-0.1, 0.42, 0.76], 0.06, 0.06, 0.02, 6, C.chrome);
    L.metal.cyl([-0.1, 0.42, 0.78], 0.012, 0.012, 0.18, 4, C.chrome, false);
    glowing(L, 1.7, (g) =>
      g.cyl([-0.1, 0.42, 0.9], 0.1, 0.075, 0.16, 8, C.lamp)
    );
  });
  return [{ p: pt(at, yaw, [0, 0.42, 1.0]), intensity: 0.55, radius: 1.6 }];
}

/**
 * A flat TV on the wall (1.0 m wide, its middle 1.4 m up), on: the ship's
 * channel, a dim blue screen with her map on it, a red standby light.
 * Origin: the wall's foot; x out of the wall.
 */
export function tv(L: ModernLayers, at: P3, yaw: number): Lamp[] {
  placed(L, at, yaw, () => {
    L.metal.box([0.025, 0, 1.4], 0.05, 1.0, 0.6, C.black, { back: true });
    glowing(L, 0.9, (g) => {
      faceX(g, 0.051, -0.47, 0.47, 1.13, 1.67, C.screen);
      faceX(g, 0.052, -0.3, 0.3, 1.25, 1.55, lin(0.4, 0.7, 0.9));
      faceX(g, 0.053, -0.22, 0.18, 1.36, 1.42, C.white);
    });
    glowing(L, 2, (g) => g.ball([0.052, 0.42, 1.115], 0.006, C.red));
  });
  return [];
}

/**
 * The balcony's glass door (default 1.8 m wide, 2.2 m high), open: a grey
 * aluminium frame, the fixed leaf over the −y half and the sliding leaf
 * slid behind it, a chrome pull, sheer curtains gathered either side on a
 * track. Origin: the doorway's middle at the floor; x into the room.
 */
export function balconyDoor(
  L: ModernLayers,
  at: P3,
  yaw: number,
  width = 1.8,
  h = 2.2
): Lamp[] {
  const W = width / 2;
  placed(L, at, yaw, () => {
    const m = L.metal;
    const alu = C.steel;
    for (const sg of [-1, 1])
      m.box([0, sg * (W + 0.03), h / 2], 0.12, 0.06, h, alu, { bottom: true });
    m.box([0, 0, h + 0.03], 0.12, width + 0.12, 0.06, alu);
    m.box([0, 0, 0.01], 0.12, width + 0.12, 0.02, alu, { bottom: true });
    for (const x of [-0.03, 0.03]) {
      pane(L, [x, -W, 0.04], [x, 0, 0.04], [x, 0, h - 0.02], [x, -W, h - 0.02]);
      m.box([x, -0.02, h / 2], 0.025, 0.04, h - 0.04, alu, { bottom: true });
      m.box([x, -W / 2, 0.06], 0.025, W, 0.06, alu, { bottom: true });
      m.box([x, -W / 2, h - 0.04], 0.025, W, 0.05, alu);
    }
    m.box([0.06, -0.08, 1.05], 0.03, 0.025, 0.4, C.chrome);
    // Sheers gathered either side, on a track.
    for (const sg of [-1, 1])
      L.shell.box(
        [0.15, sg * (W + 0.24), (h + 0.24) / 2],
        0.12,
        0.4,
        h + 0.24,
        scale(C.white, 0.96),
        { bottom: true }
      );
    m.box([0.15, 0, h + 0.26], 0.04, width + 1.0, 0.04, C.steel);
  });
  return [];
}

/**
 * A balcony chair (not blocking): a grey steel frame, a dark sling seat
 * and back, teak armrests.
 */
export function balconyChair(L: ModernLayers, at: P3, yaw: number): Lamp[] {
  placed(L, at, yaw, () => {
    const m = L.metal;
    const s = L.shell;
    for (const x of [-0.22, 0.2])
      for (const y of [-0.24, 0.24])
        m.beam([x, y, 0], [x * 0.95, y * 0.95, 0.42], 0.03, 0.03, C.steel);
    s.box([0, 0, 0.44], 0.46, 0.5, 0.04, C.sling);
    s.beam([-0.22, 0, 0.46], [-0.3, 0, 0.92], 0.5, 0.03, C.sling);
    for (const y of [-0.27, 0.27]) {
      m.beam([-0.22, y, 0.44], [-0.3, y, 0.92], 0.03, 0.03, C.steel);
      m.beam([0.19, y, 0.42], [0.19, y, 0.64], 0.025, 0.025, C.steel);
      tiled(L.wood, MT.teak, () =>
        L.wood.beam([-0.26, y, 0.66], [0.23, y, 0.65], 0.06, 0.03, C.teak)
      );
    }
  });
  return [];
}

/**
 * A shut cabin door: a veneer leaf in a cream frame, a steel kick plate,
 * a chrome lever, a card lock with its green light, a gold number plate.
 * Origin: the wall's foot under its middle; x out of the wall.
 */
export function cabinDoor(L: ModernLayers, at: P3, yaw: number): Lamp[] {
  const W = 0.82;
  const H = 2.05;
  placed(L, at, yaw, () => {
    const s = L.shell;
    const m = L.metal;
    for (const y of [-(W / 2 + 0.05), W / 2 + 0.05])
      s.box([0.02, y, (H + 0.08) / 2], 0.04, 0.1, H + 0.08, C.cream, {
        back: true,
        bottom: true,
      });
    s.box([0.02, 0, H + 0.08], 0.04, W + 0.2, 0.1, C.cream, { back: true });
    tiled(L.wood, MT.veneer, () =>
      L.wood.box([0.015, 0, H / 2], 0.03, W, H, C.veneerDark, {
        back: true,
        bottom: true,
      })
    );
    m.box([0.032, 0, 0.12], 0.006, W - 0.06, 0.22, C.steel, { back: true });
    const hy = -W / 2 + 0.1;
    m.box([0.04, hy, 1.02], 0.02, 0.04, 0.1, C.chrome, { back: true });
    m.beam([0.06, hy, 1.04], [0.06, hy + 0.14, 1.04], 0.025, 0.02, C.chrome);
    m.box([0.04, hy, 1.22], 0.02, 0.07, 0.12, C.black, { back: true });
    glowing(L, 2.2, (g) =>
      g.box([0.051, hy, 1.255], 0.004, 0.014, 0.014, C.green, { back: true })
    );
    m.box([0.034, 0, 1.6], 0.008, 0.16, 0.08, C.gold, { back: true });
  });
  return [];
}

// --- The lobby bar -------------------------------------------------------------------

/**
 * The lobby bar's counter (0.7 × 3.0), its customers' side +x: a dark
 * veneer body with three backlit onyx panels (they glow warm and light the
 * floor in front), a marble top, a chrome foot rail, bottles, an ice
 * bucket and a bowl of lemons on top.
 */
export function barCounter(L: ModernLayers, at: P3, yaw: number): Lamp[] {
  placed(L, at, yaw, () => {
    const w = L.wood;
    const s = L.shell;
    const m = L.metal;
    tiled(w, MT.veneer, () => {
      w.box([-0.03, 0, 0.53], 0.6, 2.96, 1.0, C.veneerDark, { bottom: true });
      for (const y of [-1.42, -0.46, 0.46, 1.42])
        w.box([0.277, y, 0.58], 0.014, 0.06, 0.84, C.veneerDark, {
          back: true,
        });
    });
    s.box([0, 0, 0.05], 0.54, 2.9, 0.1, C.black, { bottom: true });
    glowing(L, 1.3, (g) => {
      for (const [ya, yb] of [
        [-1.39, -0.49],
        [-0.43, 0.43],
        [0.49, 1.39],
      ] as const)
        faceX(g, 0.272, ya, yb, 0.2, 0.96, C.onyx);
    });
    tiled(s, MT.marble, () =>
      s.box([0.03, 0, 1.07], 0.64, 3.0, 0.06, C.marble)
    );
    m.tube([0.3, -1.42, 0.2], [0.3, 1.42, 0.2], 0.025, 6, C.chrome, true);
    for (const y of [-1.2, 0, 1.2])
      m.box([0.29, y, 0.12], 0.02, 0.03, 0.16, C.chrome);
    // On the top: bottles, an ice bucket, lemons.
    const bottles: [number, RGB][] = [
      [-1.2, lin(0.2, 0.5, 0.25)],
      [-1.08, lin(0.7, 0.45, 0.12)],
      [-0.96, lin(0.85, 0.85, 0.9)],
    ];
    for (const [y, c] of bottles) {
      s.cyl([-0.15, y, 1.1], 0.04, 0.04, 0.22, 6, c);
      s.cyl([-0.15, y, 1.32], 0.04, 0.015, 0.08, 6, c, false);
    }
    m.cyl([-0.12, 0.9, 1.1], 0.09, 0.11, 0.18, 8, C.chrome);
    s.cyl([-0.12, 0.2, 1.1], 0.14, 0.15, 0.04, 8, C.white);
    for (const [x, y] of [
      [-0.14, 0.17],
      [-0.09, 0.24],
      [-0.1, 0.15],
    ])
      s.ball([x, y, 1.18], 0.04, C.yellow, 0.035);
  });
  return [{ p: pt(at, yaw, [0.6, 0, 0.5]), intensity: 0.45, radius: 1.4 }];
}

/** A bar stool (not blocking): a chrome pedestal and ring, a red seat. */
export function barStool(L: ModernLayers, at: P3, yaw: number): Lamp[] {
  placed(L, at, yaw, () => {
    const m = L.metal;
    m.cyl([0, 0, 0], 0.2, 0.2, 0.02, 10, C.chrome);
    m.cyl([0, 0, 0.02], 0.03, 0.03, 0.64, 6, C.chrome, false);
    m.cyl([0, 0, 0.3], 0.17, 0.17, 0.02, 10, C.chrome);
    L.shell.cyl([0, 0, 0.66], 0.19, 0.21, 0.09, 10, C.red);
  });
  return [];
}

// --- The kids' club ------------------------------------------------------------------

/** The pirate ship's hull, stern to bow, its half widths at the gunwale. */
const HULL: readonly (readonly [number, number])[] = [
  [-1.5, 0.55],
  [-1.1, 0.7],
  [-0.4, 0.76],
  [0.3, 0.72],
  [0.9, 0.52],
  [1.3, 0.28],
  [1.58, 0],
];
/** At the foot of the hull its plan is narrower (and its bow less long). */
function hullAt(i: number, t: number): readonly [number, number] {
  const [x, y] = HULL[i];
  const k = 0.78 + 0.22 * t;
  return [x > 0 ? x * (0.92 + 0.08 * t) : x, y * k];
}

/**
 * A play pirate ship (3.2 × 1.6), its bow +x: a red hull with a yellow
 * stripe and navy portholes, a brown bulwark, a teak deck, a mast with a
 * crow's nest, a white sail with a red stripe and a black flag, a
 * bowsprit and a ship's wheel at the stern.
 */
export function pirateShip(L: ModernLayers, at: P3, yaw: number): Lamp[] {
  placed(L, at, yaw, () => {
    const s = L.shell;
    const w = L.wood;
    const bands: [number, number, Builder, RGB][] = [
      [0, 0.55, s, C.red],
      [0.55, 0.68, s, C.yellow],
      [0.68, 0.95, w, scale(C.seatWood, 1.6)],
    ];
    const H = 0.95;
    for (const [za, zb, b, col] of bands) {
      const ta = za / H;
      const tb = zb / H;
      tiled(b, b === w ? TILE.grain : TILE.none, () => {
        for (let i = 0; i < HULL.length - 1; i += 1) {
          const a0 = hullAt(i, ta);
          const a1 = hullAt(i + 1, ta);
          const b0 = hullAt(i, tb);
          const b1 = hullAt(i + 1, tb);
          // Port (+y) and starboard (−y), outward.
          b.quad(
            [a1[0], a1[1], za],
            [a0[0], a0[1], za],
            [b0[0], b0[1], zb],
            [b1[0], b1[1], zb],
            col
          );
          b.quad(
            [a0[0], -a0[1], za],
            [a1[0], -a1[1], za],
            [b1[0], -b1[1], zb],
            [b0[0], -b0[1], zb],
            col
          );
        }
        // The transom.
        const a = hullAt(0, ta);
        const bb = hullAt(0, tb);
        b.quad(
          [a[0], a[1], za],
          [a[0], -a[1], za],
          [bb[0], -bb[1], zb],
          [bb[0], bb[1], zb],
          scale(col, 0.85)
        );
      });
    }
    // The deck and the bulwark's inside.
    const DZ = 0.7;
    tiled(w, MT.teak, () => {
      for (let i = 0; i < HULL.length - 1; i += 1) {
        const p0 = hullAt(i, DZ / H);
        const p1 = hullAt(i + 1, DZ / H);
        w.quad(
          [p0[0], -p0[1], DZ],
          [p1[0], -p1[1], DZ],
          [p1[0], p1[1], DZ],
          [p0[0], p0[1], DZ],
          C.teak
        );
      }
    });
    tiled(w, TILE.grain, () => {
      for (let i = 0; i < HULL.length - 1; i += 1) {
        const a0 = hullAt(i, DZ / H);
        const a1 = hullAt(i + 1, DZ / H);
        const b0 = hullAt(i, 1);
        const b1 = hullAt(i + 1, 1);
        const col = scale(C.seatWood, 1.3);
        w.quad(
          [a0[0], a0[1] - 0.01, DZ],
          [a1[0], a1[1] - 0.01, DZ],
          [b1[0], b1[1] - 0.01, H],
          [b0[0], b0[1] - 0.01, H],
          col
        );
        w.quad(
          [a1[0], -a1[1] + 0.01, DZ],
          [a0[0], -a0[1] + 0.01, DZ],
          [b0[0], -b0[1] + 0.01, H],
          [b1[0], -b1[1] + 0.01, H],
          col
        );
      }
      // Mast, crow's nest, yard, bowsprit, the wheel.
      const brown = scale(C.seatWood, 1.5);
      w.cyl([0.15, 0, DZ], 0.06, 0.045, 1.42, 6, brown);
      w.cyl([0.15, 0, 1.62], 0.17, 0.2, 0.14, 8, brown);
      w.beam([0.15, -0.6, 1.5], [0.15, 0.6, 1.5], 0.04, 0.04, brown);
      w.beam([1.3, 0, 0.9], [1.6, 0, 1.0], 0.05, 0.05, brown);
      w.cyl([-1.05, 0, DZ], 0.04, 0.04, 0.42, 6, brown, false);
      w.tube([-1.02, 0, 1.24], [-0.98, 0, 1.24], 0.22, 8, brown, true);
    });
    s.ball([-0.97, 0, 1.24], 0.04, C.yellow);
    // Portholes.
    for (const i of [1, 2, 3]) {
      const x = (HULL[i][0] + HULL[i + 1][0]) / 2;
      const y = (hullAt(i, 0.47)[1] + hullAt(i + 1, 0.47)[1]) / 2;
      for (const sg of [-1, 1])
        s.tube(
          [x, sg * (y - 0.01), 0.42],
          [x, sg * (y + 0.012), 0.42],
          0.07,
          8,
          C.navy,
          true
        );
    }
    // The sail (both faces), its stripe, the flag.
    const sail = (x: number, za: number, zb: number, col: RGB) => {
      const q = (k: number, z: number, y: number): P3 => [
        x + (k ? 0.12 : 0),
        y,
        z,
      ];
      for (const [ya, yb, ka, kb] of [
        [-0.58, 0, 0, 1],
        [0, 0.58, 1, 0],
      ] as const) {
        s.quad(q(ka, za, ya), q(kb, za, yb), q(kb, zb, yb), q(ka, zb, ya), col);
        s.quad(q(ka, zb, ya), q(kb, zb, yb), q(kb, za, yb), q(ka, za, ya), col);
      }
    };
    sail(0.2, 0.98, 1.47, C.white);
    sail(0.215, 1.16, 1.26, C.red);
    const f0: P3 = [0.15, 0, 2.12];
    const f1: P3 = [0.15, 0, 1.96];
    const f2: P3 = [-0.22, 0, 2.04];
    s.tri(f0, f1, f2, C.black);
    s.tri(f0, f2, f1, C.black);
  });
  return [];
}

/**
 * A play castle tower (1.6 × 1.6): a purple round tower with pink
 * battlements, a dark door (+x) and windows, a pink turret roof with a
 * yellow ball on top.
 */
export function castleTower(L: ModernLayers, at: P3, yaw: number): Lamp[] {
  const R = 0.72;
  placed(L, at, yaw, () => {
    const s = L.shell;
    s.cyl([0, 0, 0], R, R, 1.5, 12, C.purple);
    for (let i = 0; i < 8; i += 1) {
      const a = ((i + 0.5) / 8) * Math.PI * 2;
      s.cyl(
        [Math.cos(a) * (R - 0.08), Math.sin(a) * (R - 0.08), 1.5],
        0.11,
        0.11,
        0.22,
        6,
        C.pink
      );
    }
    s.cyl([0, 0, 1.5], 0.5, 0.0, 0.62, 10, C.pink);
    s.ball([0, 0, 2.13], 0.045, C.yellow);
    const dark = lin(0.2, 0.12, 0.3);
    s.box([R - 0.01, 0, 0.42], 0.06, 0.5, 0.84, dark, { back: true });
    s.box([R - 0.01, 0, 0.86], 0.06, 0.36, 0.1, dark, { back: true });
    for (const sg of [-1, 1])
      s.box([0, sg * (R - 0.01), 1.06], 0.14, 0.06, 0.28, dark, {
        back: true,
      });
  });
  return [];
}

/** A beanbag (0.8 across): a lumpy, dented pouf in a colour of its own. */
export function beanbag(L: ModernLayers, at: P3, yaw: number): Lamp[] {
  const colors = [C.red, C.blue, C.yellow, C.green, C.orange, C.purple];
  const k =
    Math.abs(Math.round(at[0] * 7.3 + at[1] * 3.1 + yaw * 5)) % colors.length;
  const col = colors[k];
  const prof: [number, number][] = [
    [0.3, 0.0],
    [0.39, 0.1],
    [0.38, 0.28],
    [0.28, 0.42],
    [0.12, 0.44],
    [0.0, 0.39],
  ];
  const N = 10;
  placed(L, at, yaw, () => {
    const s = L.shell;
    const ring = (r: number, z: number, i: number): P3 => {
      const a = (i / N) * Math.PI * 2;
      // Lumpy: a little longer one way, a slouch to the back.
      return [r * Math.cos(a) - z * 0.08, r * Math.sin(a), z];
    };
    for (let j = 0; j < prof.length - 1; j += 1) {
      const [r0, z0] = prof[j];
      const [r1, z1] = prof[j + 1];
      for (let i = 0; i < N; i += 1)
        s.quad(
          ring(r0, z0, i),
          ring(r0, z0, i + 1),
          ring(r1, z1, i + 1),
          ring(r1, z1, i),
          scale(col, 0.8 + 0.2 * (j / (prof.length - 1)))
        );
    }
  });
  return [];
}

/**
 * A kids' table (1.3 × 1.3 with its stools): a low round yellow table on
 * a blue foot, four stools in four colours, a sheet of paper and crayons.
 */
export function kidsTable(L: ModernLayers, at: P3, yaw: number): Lamp[] {
  placed(L, at, yaw, () => {
    const s = L.shell;
    s.cyl([0, 0, 0], 0.25, 0.25, 0.02, 8, C.blue);
    s.cyl([0, 0, 0.02], 0.05, 0.05, 0.46, 6, C.blue, false);
    s.cyl([0, 0, 0.48], 0.42, 0.42, 0.04, 12, C.yellow);
    [C.red, C.green, C.blue, C.orange].forEach((c, i) => {
      const a = (i / 4) * Math.PI * 2;
      s.cyl(
        [Math.cos(a) * 0.51, Math.sin(a) * 0.51, 0],
        0.13,
        0.13,
        0.28,
        8,
        c
      );
    });
    s.quad(
      [-0.15, -0.1, 0.521],
      [0.12, -0.12, 0.521],
      [0.14, 0.08, 0.521],
      [-0.13, 0.1, 0.521],
      C.white
    );
    [C.red, C.blue, C.green].forEach((c, i) =>
      s.beam(
        [0.2, -0.05 + i * 0.05, 0.53],
        [0.3, 0.0 + i * 0.05, 0.53],
        0.015,
        0.015,
        c
      )
    );
  });
  return [];
}

/**
 * A toy shelf (0.4 × 1.4, 0.9 high), back to −x: birch, six cubbies with
 * bins in six colours, a ball, a stack of blocks and a yellow duck on top.
 */
export function toyShelf(L: ModernLayers, at: P3, yaw: number): Lamp[] {
  placed(L, at, yaw, () => {
    const w = L.wood;
    const s = L.shell;
    tiled(w, TILE.grain, () => {
      for (const y of [-0.68, 0.68])
        w.box([0, y, 0.45], 0.38, 0.04, 0.9, C.birch, { bottom: true });
      w.box([0, 0, 0.88], 0.4, 1.4, 0.04, C.birch);
      w.box([0, 0, 0.04], 0.38, 1.32, 0.08, C.birch, { bottom: true });
      w.box([0, 0, 0.46], 0.38, 1.32, 0.03, C.birch);
      w.box([-0.18, 0, 0.45], 0.02, 1.32, 0.82, scale(C.birch, 0.85));
      for (const y of [-0.22, 0.22])
        w.box([0, y, 0.45], 0.38, 0.03, 0.82, C.birch);
    });
    const bins = [C.red, C.yellow, C.blue, C.green, C.orange, C.purple];
    let k = 0;
    for (const z of [0.24, 0.62])
      for (const y of [-0.45, 0, 0.45]) {
        s.box([0.03, y, z], 0.3, 0.38, 0.26, bins[k], { bottom: true });
        k += 1;
      }
    s.ball([0.02, -0.45, 1.0], 0.1, C.red, 0.1);
    [C.blue, C.yellow, C.green].forEach((c, i) =>
      s.box([0.0, 0.05, 0.94 + i * 0.09], 0.1 - i * 0.015, 0.1, 0.08, c, {
        bottom: true,
      })
    );
    s.ball([0.02, 0.45, 0.97], 0.08, C.yellow, 0.07);
    s.ball([0.05, 0.47, 1.08], 0.05, C.yellow);
    s.box([0.11, 0.47, 1.08], 0.05, 0.03, 0.02, C.orange);
  });
  return [];
}

/**
 * Soft play (2.0 × 2.0): foam shapes in bright colours: a big step and a
 * low one, a ramp down from the big step, a roll, a cube with a smaller
 * one on it.
 */
export function softPlay(L: ModernLayers, at: P3, yaw: number): Lamp[] {
  placed(L, at, yaw, () => {
    const s = L.shell;
    s.box([-0.55, -0.55, 0.3], 0.8, 0.8, 0.6, C.red, { bottom: true });
    s.box([-0.55, 0.2, 0.15], 0.8, 0.7, 0.3, C.yellow, { bottom: true });
    // The ramp: from the big step's top (x −0.15) down to the floor.
    const [x0, x1, y0, y1, h] = [-0.15, 0.85, -0.95, -0.15, 0.6];
    s.quad([x0, y0, h], [x1, y0, 0], [x1, y1, 0], [x0, y1, h], C.blue);
    s.tri([x0, y0, 0], [x1, y0, 0], [x0, y0, h], scale(C.blue, 0.85));
    s.tri([x0, y1, 0], [x0, y1, h], [x1, y1, 0], scale(C.blue, 0.85));
    s.tube([0.4, 0.3, 0.25], [0.4, 0.95, 0.25], 0.25, 10, C.green, true);
    s.box([0.72, 0.05, 0.18], 0.36, 0.36, 0.36, C.purple, { bottom: true });
    s.box([0.72, 0.05, 0.48], 0.26, 0.26, 0.24, C.orange, { bottom: true });
  });
  return [];
}

// --- Emergency lamps and exit signs --------------------------------------------------

/** An exit sign's middle over the floor (m): over a door's head. */
export const EXIT_SIGN_Z = 2.25;

/**
 * A green exit sign: a white housing, a green face with a white running
 * figure, its door and an arrow, glowing on the emergency supply. Origin:
 * the wall's foot; x out of the wall; `z` the sign's middle.
 */
export function exitSign(
  L: ModernLayers,
  at: P3,
  yaw: number,
  z = EXIT_SIGN_Z
): Lamp[] {
  placed(L, at, yaw, () => {
    L.metal.box([0.03, 0, z], 0.06, 0.4, 0.18, C.white, { back: true });
    glowing(
      L,
      2.6,
      (g) => {
        faceX(g, 0.061, -0.18, 0.18, z - 0.07, z + 0.07, C.exitGreen);
        const W = C.white;
        const X = 0.063;
        const P = (y: number, dz: number) => [y, z + dz] as const;
        // The door.
        stroke(g, X, P(0.12, -0.06), P(0.12, 0.055), 0.01, W);
        stroke(g, X, P(0.17, -0.06), P(0.17, 0.055), 0.01, W);
        stroke(g, X, P(0.115, 0.055), P(0.175, 0.055), 0.01, W);
        // The runner.
        g.quad(
          [X, 0.083, z + 0.032],
          [X, 0.103, z + 0.032],
          [X, 0.103, z + 0.052],
          [X, 0.083, z + 0.052],
          W
        );
        stroke(g, X, P(0.09, 0.022), P(0.065, -0.02), 0.016, W);
        stroke(g, X, P(0.065, -0.02), P(0.085, -0.04), 0.011, W);
        stroke(g, X, P(0.085, -0.04), P(0.083, -0.062), 0.011, W);
        stroke(g, X, P(0.065, -0.02), P(0.04, -0.035), 0.011, W);
        stroke(g, X, P(0.04, -0.035), P(0.028, -0.055), 0.011, W);
        stroke(g, X, P(0.085, 0.012), P(0.108, -0.005), 0.01, W);
        stroke(g, X, P(0.08, 0.012), P(0.058, 0.018), 0.01, W);
        // The arrow, pointing the way (−y).
        stroke(g, X, P(-0.15, 0), P(-0.04, 0), 0.014, W);
        stroke(g, X, P(-0.152, 0.004), P(-0.115, 0.04), 0.014, W);
        stroke(g, X, P(-0.152, -0.004), P(-0.115, -0.04), 0.014, W);
      },
      MT.emergency
    );
  });
  return [];
}

/** Emergency strips: at the floor and under the ceiling (m over the floor). */
export const EMERGENCY_LOW_Z = 0.1;

/**
 * An emergency lamp strip `length` long along a wall (local y), glowing on
 * the emergency supply: low ones (under 1.2 m) are the green-yellow path
 * lights, dashed so they read as a line to follow; high ones a continuous
 * white strip under the ceiling. Origin: the wall's foot; x out of the
 * wall; `z` the strip's height over it.
 */
export function emergencyLamp(
  L: ModernLayers,
  at: P3,
  yaw: number,
  length = 3,
  z = EMERGENCY_LOW_Z
): Lamp[] {
  const low = z < 1.2;
  const Y = length / 2;
  placed(L, at, yaw, () => {
    L.metal.box([0.012, 0, z], 0.024, length, 0.045, C.steel, { back: true });
    glowing(
      L,
      low ? 2.4 : 2.8,
      (g) => {
        if (!low) {
          faceX(
            g,
            0.0245,
            -Y + 0.02,
            Y - 0.02,
            z - 0.012,
            z + 0.012,
            C.emergencyHigh
          );
          return;
        }
        const n = Math.max(1, Math.floor(length / 0.4));
        const step = length / n;
        for (let i = 0; i < n; i += 1) {
          const y0 = -Y + step * i + 0.05;
          faceX(
            g,
            0.0245,
            y0,
            y0 + step - 0.1,
            z - 0.012,
            z + 0.012,
            C.emergencyLow
          );
        }
      },
      MT.emergency
    );
  });
  return [];
}

// --- Her lamps (the lamp styles) -------------------------------------------------------

/** A recessed downlight: a chrome ring, a glowing disc. Origin: ceiling. */
export function downlight(L: ModernLayers, at: P3): Lamp[] {
  const N = 8;
  placed(L, at, 0, () => {
    const ring = (r: number, i: number, z: number): P3 => {
      const a = (i / N) * Math.PI * 2;
      return [r * Math.cos(a), r * Math.sin(a), z];
    };
    // Both face down: the ring an annulus, the disc a fan.
    for (let i = 0; i < N; i += 1)
      L.metal.quad(
        ring(0.09, i + 1, -0.004),
        ring(0.09, i, -0.004),
        ring(0.06, i, -0.004),
        ring(0.06, i + 1, -0.004),
        C.chrome
      );
    glowing(L, 2.4, (g) => {
      for (let i = 0; i < N; i += 1)
        g.tri(
          [0, 0, -0.008],
          ring(0.06, i + 1, -0.008),
          ring(0.06, i, -0.008),
          C.lamp
        );
    });
  });
  return [{ p: [at[0], at[1], at[2] - 0.3], intensity: 0.95, radius: 2.3 }];
}

/**
 * A cove strip `length` long under the ceiling along a wall (local y): a
 * white lip with a warm glowing strip over it. Origin: the wall at the
 * ceiling; x out of the wall. Lamps every 2.5 m.
 */
export function stripLight(
  L: ModernLayers,
  at: P3,
  yaw: number,
  length: number
): Lamp[] {
  const Y = length / 2;
  placed(L, at, yaw, () => {
    L.shell.box([0.1, 0, -0.08], 0.2, length, 0.03, C.white, { back: true });
    L.shell.box([0.19, 0, -0.14], 0.02, length, 0.12, C.white, {
      back: true,
    });
    glowing(L, 2.0, (g) =>
      g.quad(
        [0.04, -Y, -0.064],
        [0.17, -Y, -0.064],
        [0.17, Y, -0.064],
        [0.04, Y, -0.064],
        C.lamp
      )
    );
  });
  const n = Math.max(1, Math.round(length / 2.5));
  return Array.from({ length: n }, (_, i) => ({
    p: pt(at, yaw, [0.4, -Y + (length * (i + 0.5)) / n, -0.3]),
    intensity: 0.6,
    radius: 2.2,
  }));
}

/**
 * The atrium's chandelier: three rings of glowing crystal drops, each
 * smaller and lower, hung on wires from a chrome canopy, a bright drop in
 * the middle. Origin: the ceiling point over the well. Its lamp is wide
 * (it lights the well, as the Titanic's dome).
 */
export function chandelier(L: ModernLayers, at: P3): Lamp[] {
  const SEG = 16;
  placed(L, at, 0, () => {
    const m = L.metal;
    m.cyl([0, 0, -0.06], 0.25, 0.25, 0.06, 10, C.chrome);
    m.beam([0, 0, -0.06], [0, 0, -1.9], 0.02, 0.02, C.chrome, false);
    for (let k = 0; k < 3; k += 1) {
      const r = 1.4 - 0.42 * k;
      const z = -1.0 - 0.45 * k;
      for (let i = 0; i < 4; i += 1) {
        const a = ((i + 0.5) / 4) * Math.PI * 2 + k * 0.4;
        m.beam(
          [0, 0, -0.06],
          [r * Math.cos(a), r * Math.sin(a), z],
          0.012,
          0.012,
          C.chrome,
          false
        );
      }
      for (let i = 0; i < SEG; i += 1) {
        const a0 = (i / SEG) * Math.PI * 2;
        const a1 = ((i + 1) / SEG) * Math.PI * 2;
        m.beam(
          [r * Math.cos(a0), r * Math.sin(a0), z],
          [r * Math.cos(a1), r * Math.sin(a1), z],
          0.03,
          0.03,
          C.chrome,
          false
        );
      }
      glowing(L, 2.2, (g) => {
        const n = 14 - 3 * k;
        for (let i = 0; i < n; i += 1) {
          const a = ((i + 0.5) / n) * Math.PI * 2;
          g.ball(
            [r * Math.cos(a), r * Math.sin(a), z - 0.16],
            0.045,
            C.crystal,
            0.1
          );
        }
      });
    }
    glowing(L, 2.8, (g) => g.ball([0, 0, -2.0], 0.12, C.crystal, 0.2));
  });
  return [{ p: [at[0], at[1], at[2] - 1.6], intensity: 2.0, radius: 7 }];
}

// --- By id --------------------------------------------------------------------------

export type ModernBuild = (L: ModernLayers, at: P3, yaw: number) => Lamp[];

/**
 * Every modern piece by id, at its default size, with the origin its mount
 * says (`MODERN_PIECE_MOUNT`): the room kit's `addPiece` calls these, or
 * the builders above with a room's own sizes (a rail's run, a storey's
 * height, the stage's width). The atrium stair's default is a 1.8 m wide
 * flight from `at` (its top) 4.2 m along +x, 2.8 m down.
 */
export const MODERN_PIECES: Record<ModernPieceId, ModernBuild> = {
  "glass-lift-car": (L, at, yaw) => glassLiftCar(L, at, yaw),
  "lift-shaft": (L, at, yaw) => liftShaft(L, at, yaw),
  "glass-rail": (L, at, yaw) => glassRail(L, at, yaw),
  "theatre-seat-row": (L, at, yaw) => theatreSeatRow(L, at, yaw),
  "stage-curtain": (L, at, yaw) => stageCurtain(L, at, yaw),
  "stage-lights": (L, at, yaw) => stageLights(L, at, yaw),
  "pool-edge": (L, at, yaw) => poolEdge(L, at, yaw),
  lounger,
  "cabin-bed": cabinBed,
  "cabin-sofa": cabinSofa,
  desk,
  tv,
  "balcony-door": (L, at, yaw) => balconyDoor(L, at, yaw),
  "balcony-rail": (L, at, yaw) => balconyRail(L, at, yaw),
  "balcony-chair": balconyChair,
  "cabin-door": cabinDoor,
  "bar-counter": barCounter,
  "bar-stool": barStool,
  "atrium-stair": (L, at, yaw) =>
    atriumStair(L, at, pt(at, yaw, [4.2, 0, -2.8]), 1.8),
  "pirate-ship": pirateShip,
  "castle-tower": castleTower,
  beanbag,
  "kids-table": kidsTable,
  "toy-shelf": toyShelf,
  "soft-play": softPlay,
  "exit-sign": (L, at, yaw) => exitSign(L, at, yaw),
  "emergency-lamp": (L, at, yaw) => emergencyLamp(L, at, yaw),
};
