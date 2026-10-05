import { DECK_Y } from "./coords";
import { OUTLINE_STEPS, type OutlinePoint } from "./hullShapes";
import { hullLoop, offsetPolyline, type HullPlan } from "./hullTrim";
import {
  cellKey,
  isDecor,
  type Occupancy,
} from "@/lib/ship-builder/model/grid";

/** A stretch of rail over cells [start, end) along the hull's length. */
export interface RailRun {
  start: number;
  end: number;
}

/**
 * Merges consecutive edge cells with no level-0 block into runs. `edgeZ` is the
 * model z of the edge cell (0, or beam - 1).
 */
export function railRuns(
  occupancy: Occupancy,
  lengthCells: number,
  edgeZ: number
): RailRun[] {
  const runs: RailRun[] = [];
  let start: number | null = null;
  for (let x = 0; x <= lengthCells; x++) {
    const occupant = occupancy.get(cellKey({ level: 0, x, z: edgeZ }));
    const isOpen = x < lengthCells && (!occupant || isDecor(occupant));
    if (isOpen && start === null) start = x;
    if (!isOpen && start !== null) {
      runs.push({ start, end: x });
      start = null;
    }
  }
  return runs;
}

/** Stanchion offsets from a run's start, at most `spacing` apart. */
export function stanchionOffsets(length: number, spacing: number): number[] {
  const gaps = Math.max(1, Math.ceil(length / spacing));
  return Array.from({ length: gaps + 1 }, (_, i) => (i * length) / gaps);
}

/** A rail run on one deck edge: +1 is the model z = 0 edge (world +z). */
export interface SideRun extends RailRun {
  side: 1 | -1;
}

/** A rail's route in plan view, as world (x, z) points from bow to stern. */
export interface RailPath {
  points: OutlinePoint[];
  /** True when the rail runs all the way round the hull. */
  isClosed: boolean;
}

const JOIN_TOLERANCE = 1e-6;

function isSamePoint(a: OutlinePoint, b: OutlinePoint): boolean {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) < JOIN_TOLERANCE;
}

/**
 * Joins routes whose ends meet (two edge runs that reach the same hull end
 * meet at its tip) into one continuous rail, so the corner is a bend rather
 * than two cut tubes.
 */
function joinTouchingPaths(paths: OutlinePoint[][]): RailPath[] {
  const pending = paths.map((points) => [...points]);
  let didJoin = true;
  while (didJoin) {
    didJoin = false;
    for (let i = 0; i < pending.length && !didJoin; i++) {
      for (let j = i + 1; j < pending.length && !didJoin; j++) {
        const a = pending[i];
        const b = pending[j];
        const aStart = a[0];
        const aEnd = a[a.length - 1];
        const bStart = b[0];
        const bEnd = b[b.length - 1];
        let joined: OutlinePoint[] | null = null;
        if (isSamePoint(aEnd, bStart)) joined = [...a, ...b.slice(1)];
        else if (isSamePoint(aEnd, bEnd))
          joined = [...a, ...[...b].reverse().slice(1)];
        else if (isSamePoint(aStart, bEnd)) joined = [...b, ...a.slice(1)];
        else if (isSamePoint(aStart, bStart))
          joined = [...[...a].reverse(), ...b.slice(1)];
        if (!joined) continue;
        pending.splice(j, 1);
        pending[i] = joined;
        didJoin = true;
      }
    }
  }
  return pending.map((points) => {
    const isClosed =
      points.length > 2 && isSamePoint(points[0], points[points.length - 1]);
    return { points: isClosed ? points.slice(0, -1) : points, isClosed };
  });
}

/**
 * Plan routes for the rails. A run keeps to its deck edge; one that reaches a
 * hull end carries on round that end's curve to the tip, and two runs meeting
 * at a tip become one rail. `inset` is how far inside the hull's outer edge
 * the rail's centreline sits.
 */
export function railPaths(
  runs: readonly SideRun[],
  plan: HullPlan,
  inset: number
): RailPath[] {
  const { lengthCells, beam } = plan;
  const loop = offsetPolyline(hullLoop(plan, DECK_Y), inset, true);
  const steps = OUTLINE_STEPS;
  const endSize = 2 * steps + 1;
  const bowCurve = (side: 1 | -1) =>
    side === 1
      ? loop.slice(0, steps + 1).reverse()
      : loop.slice(steps, endSize);
  // The stern is walked from the -z edge round to the +z edge in the loop.
  const sternCurve = (side: 1 | -1) =>
    side === 1
      ? loop.slice(endSize + steps, 2 * endSize).reverse()
      : loop.slice(endSize, endSize + steps + 1);

  const paths = runs.map(({ start, end, side }) => {
    const z = side * (beam / 2 - inset);
    const points: OutlinePoint[] = [];
    if (start === 0) points.push(...bowCurve(side));
    else points.push([lengthCells / 2 - start, z]);
    if (end === lengthCells) points.push(...sternCurve(side));
    else points.push([lengthCells / 2 - end, z]);
    return points;
  });
  return joinTouchingPaths(paths);
}

/** Splits a route so no segment is longer than `maxStep`. */
export function resamplePath(
  points: readonly OutlinePoint[],
  maxStep: number,
  isClosed: boolean
): OutlinePoint[] {
  const result: OutlinePoint[] = [];
  const count = isClosed ? points.length : points.length - 1;
  for (let i = 0; i < count; i++) {
    const from = points[i];
    const to = points[(i + 1) % points.length];
    const pieces = Math.max(
      1,
      Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / maxStep)
    );
    for (let k = 0; k < pieces; k++) {
      const t = k / pieces;
      result.push([
        from[0] + (to[0] - from[0]) * t,
        from[1] + (to[1] - from[1]) * t,
      ]);
    }
  }
  if (!isClosed) result.push(points[points.length - 1]);
  return result;
}

/** Total length of a route. */
export function pathLength(
  points: readonly OutlinePoint[],
  isClosed: boolean
): number {
  let total = 0;
  const count = isClosed ? points.length : points.length - 1;
  for (let i = 0; i < count; i++) {
    const to = points[(i + 1) % points.length];
    total += Math.hypot(to[0] - points[i][0], to[1] - points[i][1]);
  }
  return total;
}

/** The point `distance` along a route (clamped to its ends when open). */
export function pointAlong(
  points: readonly OutlinePoint[],
  distance: number,
  isClosed: boolean
): OutlinePoint {
  let remaining = distance;
  const count = isClosed ? points.length : points.length - 1;
  for (let i = 0; i < count; i++) {
    const from = points[i];
    const to = points[(i + 1) % points.length];
    const size = Math.hypot(to[0] - from[0], to[1] - from[1]);
    if (remaining <= size || i === count - 1) {
      const t = size === 0 ? 0 : Math.min(1, remaining / size);
      return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
    }
    remaining -= size;
  }
  return points[0];
}
