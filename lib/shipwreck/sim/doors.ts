import type { BulkheadDoor, Compartment } from "../ships/types";
import { FLOW_CAP } from "./constants";
import { type Cell, headLevel, orifice, pressureLevel } from "./flooding";

// Local bindings: global lookups are slow inside test sandboxes (vm).
const { max, min } = Math;

/**
 * Watertight doors (1.4, the Britannic): an opening in the transverse
 * bulkhead between two neighbouring compartments, the fore-and-aft
 * analogue of `crossFlow`. Water runs either way through it by the
 * orifice law on the head difference, strip by strip over the door's
 * height (as a hull opening's four strips):
 *
 *   q = Σ Cd·(A/4)·√(2g·|hₐ − h_b|)·sign,  h = max(0, surface − z_strip)
 *
 * capped like a spill so one step only half-equalises the two sides. A
 * `kind: "door"` door shuts with `SimOptions.doorsClosed` (no link); a
 * `"damage"` one (a bulkhead torn by the blast) never does.
 */

/** A door between cells[a] (aft) and cells[b] of one body. */
export interface DoorLink {
  a: number;
  b: number;
  /** Ship frame: the bulkhead's x and the door's height range (on y = 0). */
  x: number;
  zLow: number;
  zHigh: number;
  area: number;
}

const X_EPS = 1e-6;

/**
 * The run's open doors: every one, less the shut watertight doors, and
 * the torn bulkheads (`"damage"`) only if the run holds the damage that
 * tore them (`damage`, default true: a mine ship's real mine).
 */
export function openDoors(
  doors: readonly BulkheadDoor[] | undefined,
  closed: boolean,
  damage = true
): readonly BulkheadDoor[] {
  if (!doors) return [];
  if (!closed && damage) return doors;
  return doors.filter((d) => (d.kind === "damage" ? damage : !closed));
}

/**
 * The body's door links: each open door whose two compartments both have
 * a cell in it at the door's x (after a break at the door, neither half
 * has both).
 */
export function doorLinks(
  doors: readonly BulkheadDoor[] | undefined,
  comps: readonly Compartment[],
  cells: readonly Cell[]
): DoorLink[] | undefined {
  if (!doors || doors.length === 0) return undefined;
  const at = (id: string, x: number): number => {
    const comp = comps.findIndex((c) => c.id === id);
    return cells.findIndex(
      (c) =>
        c.comp === comp &&
        x >= c.slice.xFrom - X_EPS &&
        x <= c.slice.xTo + X_EPS
    );
  };
  const out: DoorLink[] = [];
  for (const d of doors) {
    const a = at(d.aftId, d.x);
    const b = at(d.fwdId, d.x);
    if (a < 0 || b < 0 || a === b) continue;
    out.push({ a, b, x: d.x, zLow: d.zLow, zHigh: d.zHigh, area: d.areaM2 });
  }
  return out.length > 0 ? out : undefined;
}

/** Flow through a door (m³/s, + from a to b) at the pose (earth z = z0 + n·p). */
export function doorFlow(
  a: Cell,
  b: Cell,
  d: DoorLink,
  nx: number,
  nz: number,
  z0: number,
  dt: number,
  airA = 0,
  airB = 0
): number {
  if (airA !== 0 || airB !== 0)
    return doorFlowAir(a, b, d, nx, nz, z0, dt, airA, airB);
  const ha = headLevel(a);
  const hb = headLevel(b);
  if (ha === hb) return 0;
  const base = z0 + nx * d.x;
  const strip = d.area / 4;
  let q = 0;
  for (let k = 0; k < 4; k += 1) {
    const ze = base + nz * (d.zLow + ((d.zHigh - d.zLow) * (k + 0.5)) / 4);
    const da = max(0, ha - ze);
    const db = max(0, hb - ze);
    if (da <= 0 && db <= 0) continue;
    q += orifice(strip, da - db);
  }
  if (q === 0) return 0;
  // Capped like a spill: one step may only half-equalise the two sides.
  const up = q > 0 ? a : b;
  const down = up === a ? b : a;
  const hUp = up === a ? ha : hb;
  if (down.water >= down.cap) return 0;
  const downSurface = down.water > 0 ? down.level : down.zMin;
  const dh = hUp - max(downSurface, base + nz * d.zLow);
  if (dh <= 0) return 0;
  const aUp = max(up.fsArea, 1);
  const aDown = max(down.fsArea, 1);
  const eq = (dh * aUp * aDown) / (aUp + aDown);
  const limit = min(eq * FLOW_CAP, up.water, down.cap - down.water) / dt;
  return q > 0 ? min(q, limit) : max(q, -limit);
}

/**
 * `doorFlow` between cells with trapped air (`ShipSpec.trappedAir`): each
 * strip on the two sides' pressures there (water plus air), water only,
 * from a side with water at the strip (no air passes between cells).
 */
function doorFlowAir(
  a: Cell,
  b: Cell,
  d: DoorLink,
  nx: number,
  nz: number,
  z0: number,
  dt: number,
  airA: number,
  airB: number
): number {
  const ha = headLevel(a);
  const hb = headLevel(b);
  const base = z0 + nx * d.x;
  const strip = d.area / 4;
  let q = 0;
  for (let k = 0; k < 4; k += 1) {
    const ze = base + nz * (d.zLow + ((d.zHigh - d.zLow) * (k + 0.5)) / 4);
    const dp = pressureLevel(a, ze, airA) - pressureLevel(b, ze, airB);
    if (dp === 0 || !((dp > 0 ? ha : hb) > ze)) continue;
    q += orifice(strip, dp);
  }
  if (q === 0) return 0;
  const up = q > 0 ? a : b;
  const down = up === a ? b : a;
  if (down.water >= down.cap) return 0;
  const pUp = headLevel(up) + (up === a ? airA : airB);
  const downSurface =
    (down.water > 0 ? down.level : down.zMin) + (up === a ? airB : airA);
  const dh = pUp - max(downSurface, base + nz * d.zLow);
  if (dh <= 0) return 0;
  const aUp = max(up.fsArea, 1);
  const aDown = max(down.fsArea, 1);
  const eq = (dh * aUp * aDown) / (aUp + aDown);
  const limit = min(eq * FLOW_CAP, up.water, down.cap - down.water) / dt;
  return q > 0 ? min(q, limit) : max(q, -limit);
}
