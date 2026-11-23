import type { ShipSpec } from "../ships/types";
import {
  HEADWAY_LOST_HALF_LIFE_S,
  HEADWAY_STOP_HALF_LIFE_S,
} from "./constants";

// Local bindings: global lookups are slow inside test sandboxes (vm).
const { exp, max } = Math;

const DEG = Math.PI / 180;

/** The options that change her way (`SimOptions` has them). */
export interface HeadwayOptions {
  enginesStopped?: boolean;
}

type Headway = ShipSpec["headway"];
type Table = readonly (readonly [number, number])[];

/**
 * Her way as a run's options leave it. Engines stopped at the first event
 * (`enginesStopped`): no profile and no turn; she coasts from her speed
 * then, halving every HEADWAY_STOP_HALF_LIFE_S (or her own `halfLifeS`).
 * Otherwise her own (the same object).
 */
export function headwayOf(h: Headway, opts: HeadwayOptions = {}): Headway {
  if (!h || !opts.enginesStopped) return h;
  const out: NonNullable<Headway> = {
    startMs: h.profile ? tableAt(h.profile, 0) : h.startMs,
    halfLifeS: h.halfLifeS ?? HEADWAY_STOP_HALF_LIFE_S,
  };
  if (h.ram) out.ram = h.ram;
  return out;
}

/** A [t, value] table at t: linear, held past the ends. */
function tableAt(p: Table, t: number): number {
  const n = p.length;
  if (t <= p[0][0]) return p[0][1];
  for (let i = 1; i < n; i += 1) {
    if (t > p[i][0]) continue;
    const [ta, va] = p[i - 1];
    const [tb, vb] = p[i];
    return tb > ta ? va + ((vb - va) * (t - ta)) / (tb - ta) : vb;
  }
  return p[n - 1][1];
}

/** The table's integral over [a, b], exactly (it is linear between points). */
function tableRun(p: Table, a: number, b: number): number {
  if (b <= a) return 0;
  let sum = 0;
  let x = a;
  let v = tableAt(p, a);
  for (const [tk, vk] of p) {
    if (tk <= a) continue;
    if (tk >= b) break;
    sum += ((v + vk) / 2) * (tk - x);
    x = tk;
    v = vk;
  }
  return sum + ((v + tableAt(p, b)) / 2) * (b - x);
}

/**
 * Earth distance the way she still has carries her over real seconds
 * t0..t1 (kinematic: no propulsion model), along her heading
 * (`headingAt`).
 *
 * - With `halfLifeS` (1.1, the Lusitania): u = u₀·2^(−t/T½) from the first
 *   event, integrated exactly.
 * - With a `profile` (1.4, the Britannic): u from the table while she
 *   floats (to `lostAt`), integrated exactly, then as for steady way.
 * - Steady way (her engine still turning): u₀ until `lostAt` (real
 *   seconds, when she went under; null while she has not), then
 *   u₀·2^(−(t − lostAt)/HEADWAY_LOST_HALF_LIFE_S).
 *
 * `opts.enginesStopped` first turns her way into a coast (`headwayOf`).
 */
export function headwayRun(
  h: Headway,
  t0: number,
  t1: number,
  lostAt: number | null = null,
  opts: HeadwayOptions = {}
): number {
  const way = headwayOf(h, opts);
  if (way?.profile) return profileRun(way.profile, t0, t1, lostAt);
  if (!way || way.startMs === 0) return 0;
  if (way.halfLifeS !== undefined) {
    const k = Math.LN2 / way.halfLifeS;
    return (way.startMs / k) * (exp(-k * t0) - exp(-k * t1));
  }
  if (lostAt === null || t1 <= lostAt) return way.startMs * (t1 - t0);
  const steady = way.startMs * max(0, lostAt - t0);
  const k = Math.LN2 / HEADWAY_LOST_HALF_LIFE_S;
  const a = max(0, t0 - lostAt);
  const b = t1 - lostAt;
  return steady + (way.startMs / k) * (exp(-k * a) - exp(-k * b));
}

function profileRun(
  p: Table,
  t0: number,
  t1: number,
  lostAt: number | null
): number {
  if (lostAt === null || t1 <= lostAt) return tableRun(p, t0, t1);
  const afloat = tableRun(p, t0, max(t0, lostAt));
  const k = Math.LN2 / HEADWAY_LOST_HALF_LIFE_S;
  const a = max(0, t0 - lostAt);
  const b = t1 - lostAt;
  return afloat + (tableAt(p, lostAt) / k) * (exp(-k * a) - exp(-k * b));
}

/** Her speed through the water (m/s) at real second t: `headwayRun`'s rate. */
export function speedAt(
  h: Headway,
  t: number,
  opts: HeadwayOptions = {},
  lostAt: number | null = null
): number {
  const way = headwayOf(h, opts);
  if (!way) return 0;
  const lost = Math.LN2 / HEADWAY_LOST_HALF_LIFE_S;
  if (way.profile) {
    if (lostAt === null || t <= lostAt) return tableAt(way.profile, t);
    return tableAt(way.profile, lostAt) * exp(-lost * (t - lostAt));
  }
  if (way.halfLifeS !== undefined)
    return way.startMs * exp(-(Math.LN2 / way.halfLifeS) * t);
  if (lostAt === null || t <= lostAt) return way.startMs;
  return way.startMs * exp(-lost * (t - lostAt));
}

/**
 * Her heading (radians, + to port: the body's yaw) at shown second t: her
 * `turn` table, held past its ends; 0 without one or with her engines
 * stopped.
 */
export function headingAt(
  h: Headway,
  t: number,
  opts: HeadwayOptions = {}
): number {
  const way = headwayOf(h, opts);
  if (!way?.turn || way.turn.length === 0) return 0;
  return tableAt(way.turn, t) * DEG;
}

/** A drift path: [shown s, earth x, earth y, heading deg] points. */
export type DriftPath = NonNullable<NonNullable<Headway>["path"]>;

/**
 * The drift path a run follows (`headway.path`, or `pathToSea` with
 * `toSea` when she has one), or null.
 */
export function pathOf(
  h: Headway,
  opts: { toSea?: boolean } = {}
): DriftPath | null {
  if (!h?.path || h.path.length === 0) return null;
  return opts.toSea && h.pathToSea && h.pathToSea.length > 0
    ? h.pathToSea
    : h.path;
}

/** Catmull-Rom (uniform) between p1 and p2 at u, and its rate in u. */
function catmull(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  u: number
): [number, number] {
  const a = 2 * p1;
  const b = p2 - p0;
  const c = 2 * p0 - 5 * p1 + 4 * p2 - p3;
  const d = -p0 + 3 * p1 - 3 * p2 + p3;
  return [
    0.5 * (a + b * u + c * u * u + d * u * u * u),
    0.5 * (b + 2 * c * u + 3 * d * u * u),
  ];
}

/**
 * Her place on a drift path at shown second t, written into `out`: earth
 * x, earth y (m), heading (radians, + to port), and her speed along it
 * (m/s). A rule, not physics: Catmull-Rom through the points (each end
 * point its own outer neighbour), the heading linear between points the
 * shortest way round, both held past the ends (speed 0 there).
 */
export function pathAt(
  p: DriftPath,
  t: number,
  out: [number, number, number, number]
): [number, number, number, number] {
  const n = p.length;
  if (n === 1 || t <= p[0][0]) {
    const q = t <= p[0][0] ? p[0] : p[n - 1];
    out[0] = q[1];
    out[1] = q[2];
    out[2] = q[3] * DEG;
    out[3] = 0;
    return out;
  }
  if (t >= p[n - 1][0]) {
    const q = p[n - 1];
    out[0] = q[1];
    out[1] = q[2];
    out[2] = q[3] * DEG;
    out[3] = 0;
    return out;
  }
  let i = 1;
  while (i < n - 1 && t > p[i][0]) i += 1;
  const a = p[i - 1];
  const b = p[i];
  const before = i >= 2 ? p[i - 2] : a;
  const after = i + 1 < n ? p[i + 1] : b;
  const span = b[0] - a[0];
  const u = span > 0 ? (t - a[0]) / span : 1;
  const [x, dx] = catmull(before[1], a[1], b[1], after[1], u);
  const [y, dy] = catmull(before[2], a[2], b[2], after[2], u);
  let turn = b[3] - a[3];
  while (turn > 180) turn -= 360;
  while (turn < -180) turn += 360;
  out[0] = x;
  out[1] = y;
  out[2] = (a[3] + turn * u) * DEG;
  out[3] = span > 0 ? Math.hypot(dx, dy) / span : 0;
  return out;
}
