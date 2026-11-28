import { deckZAt } from "../places";
import type { ShipSpec } from "../ships/types";
import type { WalkMap } from "../walk/types";
import type { InteriorMap, LiftShaft, LiftStop } from "./types";

/**
 * The glass lift ride (the Concordia's Atrio Europa; spec "The glass
 * lift"), pure: no three.js, no state. A ride is a car going from one stop
 * of its shaft to another (stop indices, bottom to top), `s` seconds in:
 * it eases in over LIFT_EASE_S, glides at LIFT_SPEED_MS and eases out over
 * LIFT_EASE_S. The walker stands still in the car the whole way (the
 * stick does nothing, the look still turns); at the end their area is the
 * car at the arrival stop, whose door (a seam) opens onto that landing.
 *
 * The car's floor at a stop is the stop's deck (plus its `raiseM`) at the
 * car's middle; a walker in the car stands on that plus her sheer between
 * the car's middle and their feet (`walkerFloorZ`), the same as the car's
 * area at either end, so the eyes never jump as a ride starts or ends.
 */

/** The car's top speed (m/s). */
export const LIFT_SPEED_MS = 1.5;
/** It eases in over this from standing, and out over this to a stop (s). */
export const LIFT_EASE_S = 1;

/** The ambient loop (the car nobody rides): seconds parked at each stop. */
export const LIFT_DWELL_S = 4;

const MIDDLES = new WeakMap<LiftShaft, readonly [number, number]>();

/** The car's middle in plan (ship x, y; one array per shaft, kept). */
export function liftMiddle(lift: LiftShaft): readonly [number, number] {
  let m = MIDDLES.get(lift);
  if (!m) {
    m = [
      (lift.car.min[0] + lift.car.max[0]) / 2,
      (lift.car.min[1] + lift.car.max[1]) / 2,
    ];
    MIDDLES.set(lift, m);
  }
  return m;
}

/** The car's floor at stop `i` (ship-frame z, at the car's middle). */
export function liftStopZ(
  lift: LiftShaft,
  spec: Pick<ShipSpec, "decks" | "sheerZ" | "sheerRefDeck">,
  i: number
): number {
  const stop = lift.stops[i];
  const x = (lift.car.min[0] + lift.car.max[0]) / 2;
  return deckZAt(stop.deck, x, spec) + (stop.raiseM ?? 0);
}

/**
 * The ride's speed profile over a distance d (m): its top speed (m/s) and
 * how long it takes (s). A ride too short to reach LIFT_SPEED_MS eases in
 * and straight out again, at a lower top speed.
 */
function profile(d: number): { v: number; total: number } {
  const ease = LIFT_SPEED_MS * LIFT_EASE_S;
  if (d >= ease)
    return {
      v: LIFT_SPEED_MS,
      total: 2 * LIFT_EASE_S + (d - ease) / LIFT_SPEED_MS,
    };
  return { v: d / LIFT_EASE_S, total: 2 * LIFT_EASE_S };
}

/** How long the ride from stop `from` to stop `to` takes (s; 0 to itself). */
export function liftRideS(
  lift: LiftShaft,
  spec: Pick<ShipSpec, "decks" | "sheerZ" | "sheerRefDeck">,
  from: number,
  to: number
): number {
  if (from === to) return 0;
  const d = Math.abs(liftStopZ(lift, spec, to) - liftStopZ(lift, spec, from));
  return d > 0 ? profile(d).total : 0;
}

/**
 * How far the car has come `s` seconds into a ride of distance d (m):
 * smoothstep speed over each ease (no jolt, the same distance as a linear
 * ease: half the ease at top speed), top speed between.
 */
function travelled(d: number, s: number): number {
  if (!(d > 0)) return 0;
  const { v, total } = profile(d);
  const t = Math.max(0, Math.min(total, s));
  const E = LIFT_EASE_S;
  // The distance covered u (0..1) of the way into an ease.
  const easeIn = (u: number) => v * E * (u * u * u - (u * u * u * u) / 2);
  if (t <= E) return easeIn(t / E);
  const cruiseEnd = total - E;
  if (t <= cruiseEnd) return (v * E) / 2 + v * (t - E);
  // The ease out mirrors the ease in.
  return d - easeIn((total - t) / E);
}

/**
 * The car floor's ship-frame z `s` seconds into the ride from stop `from`
 * to stop `to` (at the car's middle): `from`'s floor at 0 or before, `to`'s
 * at the end or after, always moving toward `to`.
 */
export function liftRideZ(
  lift: LiftShaft,
  spec: Pick<ShipSpec, "decks" | "sheerZ" | "sheerRefDeck">,
  from: number,
  to: number,
  s: number
): number {
  const z0 = liftStopZ(lift, spec, from);
  const z1 = liftStopZ(lift, spec, to);
  const d = Math.abs(z1 - z0);
  return z0 + Math.sign(z1 - z0) * travelled(d, s);
}

/**
 * The next stop from `at` going `dir` (+1 up, −1 down) that `dry` allows
 * (a stop whose landing is too deep is ridden past), or null when there is
 * none that way.
 */
export function nextStop(
  lift: LiftShaft,
  at: number,
  dir: 1 | -1,
  dry: (stop: LiftStop, index: number) => boolean
): number | null {
  for (let i = at + dir; i >= 0 && i < lift.stops.length; i += dir)
    if (dry(lift.stops[i], i)) return i;
  return null;
}

/**
 * The ambient loop: where a car nobody rides is at time `t` (s), as its
 * floor's ship-frame z. It rides from stop `lo` (default the bottom) to
 * stop `hi` (default the top), a stop at a time with LIFT_DWELL_S parked
 * at each, and back down, for ever; a pure function of `t` (the caller
 * offsets `t` per car so the two cars never move together).
 */
export function otherCarZ(
  lift: LiftShaft,
  spec: Pick<ShipSpec, "decks" | "sheerZ" | "sheerRefDeck">,
  t: number,
  lo = 0,
  hi = lift.stops.length - 1
): number {
  const n = hi - lo + 1;
  if (n < 2) return liftStopZ(lift, spec, lo);
  // Legs up (lo→lo+1 … hi−1→hi) then down; each a dwell, then the ride.
  const cycle = otherCarLoopS(lift, spec, lo, hi);
  let u = ((t % cycle) + cycle) % cycle;
  for (let leg = 0; leg < 2 * (n - 1); leg += 1) {
    const up = leg < n - 1;
    const from = lo + (up ? leg : 2 * (n - 1) - leg);
    const to = up ? from + 1 : from - 1;
    if (u < LIFT_DWELL_S) return liftStopZ(lift, spec, from);
    u -= LIFT_DWELL_S;
    const ride = liftRideS(lift, spec, from, to);
    if (u < ride) return liftRideZ(lift, spec, from, to, u);
    u -= ride;
  }
  return liftStopZ(lift, spec, lo);
}

/** The ambient loop's length (s): from `lo` up a stop at a time to `hi` and back down. */
export function otherCarLoopS(
  lift: LiftShaft,
  spec: Pick<ShipSpec, "decks" | "sheerZ" | "sheerRefDeck">,
  lo = 0,
  hi = lift.stops.length - 1
): number {
  let cycle = 0;
  for (let i = lo; i < hi; i += 1)
    cycle += 2 * (LIFT_DWELL_S + liftRideS(lift, spec, i, i + 1));
  return cycle;
}

// --- Lookups (built once per map) ----------------------------------------------

/** A lift's car at a stop: `lift-a@3`. */
export function liftCarId(lift: string, deck: string): string {
  return `${lift}@${deck}`;
}

const CAR_IDS = new WeakMap<LiftShaft, readonly string[]>();

/**
 * Each stop's car area id (`liftCarId`), bottom to top: one array per
 * shaft, kept, so a frame loop reads them without building strings.
 */
export function liftCarIds(lift: LiftShaft): readonly string[] {
  let ids = CAR_IDS.get(lift);
  if (!ids) {
    ids = lift.stops.map((s) => liftCarId(lift.id, s.deck));
    CAR_IDS.set(lift, ids);
  }
  return ids;
}

/** A car area's shaft and stop. */
export interface LiftPlace {
  lift: LiftShaft;
  stop: number;
}

interface LiftIndex {
  byId: Map<string, LiftShaft>;
  /** Each car area: its shaft and stop. */
  cars: Map<string, LiftPlace>;
  /** Each car area: its landing. */
  landing: Map<string, string>;
}

const INDEX = new WeakMap<readonly LiftShaft[], LiftIndex>();
const NO_LIFTS: readonly LiftShaft[] = [];

function liftIndex(lifts: readonly LiftShaft[]): LiftIndex {
  let ix = INDEX.get(lifts);
  if (ix) return ix;
  ix = { byId: new Map(), cars: new Map(), landing: new Map() };
  for (const lift of lifts) {
    ix.byId.set(lift.id, lift);
    lift.stops.forEach((stop, i) => {
      const id = liftCarId(lift.id, stop.deck);
      ix!.cars.set(id, { lift, stop: i });
      ix!.landing.set(id, stop.landing);
    });
  }
  INDEX.set(lifts, ix);
  return ix;
}

/** A map's (or interior's) lift by id, or undefined. */
export function liftById(
  owner: Pick<WalkMap, "lifts"> | Pick<InteriorMap, "lifts">,
  id: string
): LiftShaft | undefined {
  return liftIndex(owner.lifts ?? NO_LIFTS).byId.get(id);
}

/** The shaft and stop of a car area, or null for any other area. */
export function liftAt(
  owner: Pick<WalkMap, "lifts"> | Pick<InteriorMap, "lifts">,
  area: string
): LiftPlace | null {
  return liftIndex(owner.lifts ?? NO_LIFTS).cars.get(area) ?? null;
}

/**
 * The landing a car area opens onto (its water and lamps are the landing's
 * while it stands there), or null for any other area.
 */
export function liftLanding(
  owner: Pick<WalkMap, "lifts"> | Pick<InteriorMap, "lifts">,
  area: string
): string | null {
  return liftIndex(owner.lifts ?? NO_LIFTS).landing.get(area) ?? null;
}

/** The stop of `lift` whose landing is `room`, or −1. */
export function landingStop(lift: LiftShaft, room: string): number {
  for (let i = 0; i < lift.stops.length; i += 1)
    if (lift.stops[i].landing === room) return i;
  return -1;
}
