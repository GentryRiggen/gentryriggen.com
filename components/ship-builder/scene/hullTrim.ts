import { BufferGeometry, Float32BufferAttribute } from "three";
import { bowLength, sternLength } from "@/lib/ship-builder/model/hullEnds";
import type { BowShape, SternShape } from "@/lib/ship-builder/model/types";
import { DECK_Y } from "./coords";
import {
  BOW_SECTIONS,
  STERN_SECTIONS,
  bowFlare,
  endOutline,
  hullHalfWidth,
  type OutlinePoint,
} from "./hullShapes";

/** What the plan-view maths needs to know about a hull. */
export interface HullPlan {
  lengthCells: number;
  beam: number;
  bow: BowShape;
  stern: SternShape;
}

/** Deck plate thickness; it sits on DECK_Y so its top is DECK_Y + 0.02. */
export const DECK_PLATE = 0.02;
export const DECK_TOP = DECK_Y + DECK_PLATE;

/** The bulwark rises this far above the deck at the bow tip and the stern. */
export const BULWARK_BOW_RISE = 0.35;
export const BULWARK_STERN_RISE = 0.2;
/** The sheer starts this far inside the grid's ends. */
const BULWARK_LEAD = 1;
export const BULWARK_THICKNESS = 0.1;
/** The bulwark's outer face sits this far proud of the topsides. */
const BULWARK_PROUD = 0.004;
/** A little lip above the deck where the bulwark begins, so tops never fight. */
const BULWARK_LIP = 0.012;

/**
 * Plan outline of one end at world height `y`, in world coordinates from the
 * +z hull edge round the tip to the -z edge. A stern is mirrored in x.
 */
export function endPlan(
  kind: "bow" | "stern",
  plan: HullPlan,
  y: number
): OutlinePoint[] {
  const halfBeam = hullHalfWidth(y, plan.beam / 2);
  const isBow = kind === "bow";
  const length = isBow ? bowLength(plan.bow) : sternLength(plan.stern);
  const section = isBow
    ? BOW_SECTIONS[plan.bow](y, length)
    : STERN_SECTIONS[plan.stern](y, length);
  const origin = plan.lengthCells / 2;
  return endOutline(section, halfBeam).map(([x, z]) =>
    isBow ? [origin + x, z * bowFlare(y, x / section.reach)] : [-origin - x, z]
  );
}

/**
 * The closed plan outline of the whole hull at height `y`, as one oriented
 * loop: the bow's +z edge round to its -z edge, along the -z side to the
 * stern, round the stern and back along the +z side.
 */
export function hullLoop(plan: HullPlan, y: number): OutlinePoint[] {
  return [...endPlan("bow", plan, y), ...endPlan("stern", plan, y).reverse()];
}

function normalOf(from: OutlinePoint, to: OutlinePoint): OutlinePoint | null {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const size = Math.hypot(dx, dz);
  // Rotating the direction of travel a quarter turn gives the outward side.
  return size < 1e-9 ? null : [-dz / size, dx / size];
}

/**
 * Moves every point of an oriented outline inward by `distance` along its
 * (mitred) normal; a negative distance moves it outward.
 */
export function offsetPolyline(
  points: readonly OutlinePoint[],
  distance: number,
  isClosed: boolean
): OutlinePoint[] {
  const count = points.length;
  return points.map((point, i) => {
    const prev = i > 0 ? points[i - 1] : isClosed ? points[count - 1] : null;
    const next = i < count - 1 ? points[i + 1] : isClosed ? points[0] : null;
    const before = prev && normalOf(prev, point);
    const after = next && normalOf(point, next);
    const first = before ?? after;
    const second = after ?? before;
    if (!first || !second) return point;
    const sumX = first[0] + second[0];
    const sumZ = first[1] + second[1];
    const sumSize = Math.hypot(sumX, sumZ) || 1;
    const miterX = sumX / sumSize;
    const miterZ = sumZ / sumSize;
    const fit = Math.max(0.5, miterX * second[0] + miterZ * second[1]);
    return [
      point[0] - (miterX * distance) / fit,
      point[1] - (miterZ * distance) / fit,
    ];
  });
}

/** Height of the bulwark above the deck plate at world x, 0 amidships. */
export type SheerFn = (x: number) => number;

export function makeSheer(plan: HullPlan): SheerFn {
  const halfLength = plan.lengthCells / 2;
  const start = Math.max(0, halfLength - BULWARK_LEAD);
  const bowTip =
    halfLength + BOW_SECTIONS[plan.bow](DECK_Y, bowLength(plan.bow)).reach;
  const sternTip =
    halfLength +
    STERN_SECTIONS[plan.stern](DECK_Y, sternLength(plan.stern)).reach;
  return (x) => {
    const along = Math.abs(x);
    if (along <= start) return 0;
    const isBow = x > 0;
    const tip = isBow ? bowTip : sternTip;
    const rise = isBow ? BULWARK_BOW_RISE : BULWARK_STERN_RISE;
    const fraction = Math.min(1, (along - start) / (tip - start));
    return rise * fraction ** 1.6;
  };
}

/** The deck outline of each end with a lead-in along the straight sides. */
export function bulwarkRibbons(plan: HullPlan): OutlinePoint[][] {
  const halfLength = plan.lengthCells / 2;
  const start = Math.max(0, halfLength - BULWARK_LEAD);
  const halfBeam = plan.beam / 2;
  const bow: OutlinePoint[] = [
    [start, halfBeam],
    ...endPlan("bow", plan, DECK_Y),
    [start, -halfBeam],
  ];
  const stern: OutlinePoint[] = [
    [-start, -halfBeam],
    ...endPlan("stern", plan, DECK_Y).reverse(),
    [-start, halfBeam],
  ];
  return [bow, stern];
}

interface StripBuilder {
  positions: number[];
  indices: number[];
}

/** Adds a strip of quads between two same-length point rows. */
function addStrip(
  builder: StripBuilder,
  rowA: ReadonlyArray<readonly [number, number, number]>,
  rowC: ReadonlyArray<readonly [number, number, number]>,
  isClosed = false
): void {
  const base = builder.positions.length / 3;
  const count = rowA.length;
  for (let i = 0; i < count; i++) {
    builder.positions.push(...rowA[i], ...rowC[i]);
  }
  const quads = isClosed ? count : count - 1;
  for (let i = 0; i < quads; i++) {
    const a = base + i * 2;
    const c = a + 1;
    const next = (i + 1) % count;
    const b = base + next * 2;
    const d = b + 1;
    builder.indices.push(a, b, c, b, d, c);
  }
}

function finish(builder: StripBuilder): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(builder.positions, 3)
  );
  geometry.setIndex(builder.indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The bulwark strip painted like the topsides: a thin wall that rises from
 * flush amidships to the bow and stern, with a top face and an inner face.
 */
export function buildBulwarkGeometry(plan: HullPlan): BufferGeometry {
  const sheer = makeSheer(plan);
  const builder: StripBuilder = { positions: [], indices: [] };
  for (const ribbon of bulwarkRibbons(plan)) {
    const outer = offsetPolyline(ribbon, -BULWARK_PROUD, false);
    const inner = offsetPolyline(ribbon, BULWARK_THICKNESS, false);
    const tops = ribbon.map(([x]) => DECK_TOP + sheer(x) + BULWARK_LIP);
    const at = (points: OutlinePoint[], heights: number[]) =>
      points.map(([x, z], i) => [x, heights[i], z] as const);
    const floor = ribbon.map(() => DECK_Y);
    addStrip(builder, at(outer, floor), at(outer, tops));
    addStrip(builder, at(outer, tops), at(inner, tops));
    addStrip(builder, at(inner, tops), at(inner, floor));
  }
  return finish(builder);
}

/** One row of a band that wraps the hull: a height and its outward push. */
export interface BandRow {
  y: number;
  out: number;
}

/**
 * A band that wraps the whole hull outline (round the bow and stern), each row
 * following the hull's own plan at its height and pushed `out` from it.
 */
export function buildHullBand(
  plan: HullPlan,
  rows: readonly BandRow[]
): BufferGeometry {
  const rings = rows.map(({ y, out }) =>
    offsetPolyline(hullLoop(plan, y), -out, true).map(
      ([x, z]) => [x, y, z] as const
    )
  );
  const positions: number[] = [];
  const indices: number[] = [];
  const ringSize = rings[0].length;
  for (const ring of rings) for (const point of ring) positions.push(...point);
  for (let row = 0; row < rings.length - 1; row++) {
    for (let k = 0; k < ringSize; k++) {
      const a = row * ringSize + k;
      const b = row * ringSize + ((k + 1) % ringSize);
      const c = a + ringSize;
      const d = b + ringSize;
      indices.push(a, b, c, b, d, c);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
