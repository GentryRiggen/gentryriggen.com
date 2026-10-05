import type { BowShape, SternShape } from "@/lib/ship-builder/model/types";
import { DECK_Y, HULL_DRAFT } from "./coords";

/**
 * Pure maths for the bow and stern shapes. An end is described in its own
 * frame: `x` runs from the hull's end (0) outward to the tip, `z` is across
 * the beam. At each height the plan view is a superellipse with a given reach
 * (how far the stem sits from the hull end) and exponent (1 = pointed
 * triangle, 2 = rounded, large = square). Stacking those slices makes the
 * solid, so the side profile and the plan view come from one function.
 */
export interface EndSection {
  /** Distance from the hull end to the tip at this height. */
  reach: number;
  /** Plan-view fullness: 1 pointed, 2 elliptical, ~8 nearly square. */
  exponent: number;
}

export type EndKind = "bow" | "stern";

const KEEL_Y = -HULL_DRAFT;

/** 0 at the keel, 1 at the deck. */
function heightFraction(y: number): number {
  return Math.min(1, Math.max(0, (y - KEEL_Y) / (DECK_Y - KEEL_Y)));
}

/** 0 at the keel, 1 at the waterline and above. */
function underwaterFraction(y: number): number {
  return Math.min(1, Math.max(0, (y - KEEL_Y) / -KEEL_Y));
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** How far the bulb pokes forward of the bulbous bow's straight stem. */
export const BULB_PROTRUSION = 0.7;

/** One section function per bow shape; `length` is the shape's full reach. */
export const BOW_SECTIONS: Record<
  BowShape,
  (y: number, length: number) => EndSection
> = {
  straight: (_y, length) => ({ reach: length, exponent: 1 }),
  // The stem rakes far forward: the deck sits well ahead of the waterline.
  clipper: (y, length) => ({
    reach: length * (0.2 + 0.8 * heightFraction(y) ** 1.6),
    exponent: 1,
  }),
  // A vertical stem, shorter than the full length so the bulb fills the rest.
  bulbous: (_y, length) => ({
    reach: length - BULB_PROTRUSION,
    exponent: 1.4,
  }),
  // The forefoot cuts away below, and the stem slopes steeply back above the
  // waterline so the bow rides up onto ice. Blunt in plan view.
  icebreaker: (y, length) => ({
    reach:
      y <= 0
        ? length * (0.6 + 0.4 * smoothstep(underwaterFraction(y)))
        : length * (1 - (0.55 * y) / DECK_Y),
    exponent: 2.4,
  }),
};

export const STERN_SECTIONS: Record<
  SternShape,
  (y: number, length: number) => EndSection
> = {
  counter: (_y, length) => ({ reach: length, exponent: 2 }),
  // The underside sweeps up and aft, so the stern is deep and full at the
  // waterline and tucks in toward the keel.
  cruiser: (y, length) => ({
    reach: length * (0.15 + 0.85 * underwaterFraction(y) ** 0.8),
    exponent: 2,
  }),
  // A flat back, raked slightly so the top overhangs.
  transom: (y, length) => ({
    reach: length * (0.75 + 0.25 * heightFraction(y)),
    exponent: 8,
  }),
  canoe: (_y, length) => ({ reach: length, exponent: 1 }),
};

export function endSectionAt(
  kind: EndKind,
  shape: BowShape | SternShape,
  length: number,
  y: number
): EndSection {
  return kind === "bow"
    ? BOW_SECTIONS[shape as BowShape](y, length)
    : STERN_SECTIONS[shape as SternShape](y, length);
}

/** Radius of the rounded bilge, as a share of the draft. */
export const BILGE_RADIUS = 0.35 * HULL_DRAFT;

/**
 * The hull's half-width at world height `y`: the full half-beam above the
 * bilge, rolling in along a quarter circle to a flat keel. The middle section
 * and both ends are lofted from this one function, so they meet with no seam.
 */
export function hullHalfWidth(y: number, halfBeam: number): number {
  const radius = Math.min(BILGE_RADIUS, halfBeam);
  const arcTop = KEEL_Y + radius;
  if (y >= arcTop) return halfBeam;
  const drop = Math.min(radius, arcTop - Math.max(y, KEEL_Y));
  return halfBeam - radius + Math.sqrt(radius * radius - drop * drop);
}

/** Heights where the bilge arc needs a row to read as round. */
export function bilgeHeights(steps = 5): number[] {
  return Array.from({ length: steps }, (_, i) => {
    const angle = (Math.PI / 2) * ((i + 1) / (steps + 1));
    return KEEL_Y + BILGE_RADIUS * (1 - Math.cos(angle));
  });
}

/** How much the bow narrows at its waterline relative to the deck. */
const BOW_FLARE = 0.12;

/**
 * Bow flare: a multiplier on the half-width of a bow slice. 1 at the hull
 * end and at deck level; the sections below the deck pull in toward the stem,
 * so the bow widens slightly toward the deck.
 * `reachFraction` is the distance from the hull end divided by the reach.
 */
export function bowFlare(y: number, reachFraction: number): number {
  const aboveWater = Math.min(1, Math.max(0, y / DECK_Y));
  return 1 - BOW_FLARE * reachFraction * (1 - aboveWater) ** 2;
}

/** Points per side of the outline (plus the tip). */
export const OUTLINE_STEPS = 12;

export type OutlinePoint = readonly [x: number, z: number];

/**
 * The plan outline of one slice, from the +z hull edge (x = 0) round the tip
 * to the -z hull edge. Superellipse: x = reach·sin^(2/n)φ, w = R·cos^(2/n)φ.
 */
export function endOutline(
  section: EndSection,
  halfBeam: number,
  steps = OUTLINE_STEPS
): OutlinePoint[] {
  const power = 2 / section.exponent;
  const side: OutlinePoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const phi = (Math.PI / 2) * (i / steps);
    side.push([
      section.reach * Math.sin(phi) ** power,
      halfBeam * Math.cos(phi) ** power,
    ]);
  }
  const mirrored = side
    .slice(0, -1)
    .reverse()
    .map(([x, z]): OutlinePoint => [x, -z]);
  return [...side, ...mirrored];
}

/** Half-width of a slice at distance x from the hull end (0 past the tip). */
export function halfWidthAt(
  section: EndSection,
  halfBeam: number,
  x: number
): number {
  if (x >= section.reach) return 0;
  const ratio = Math.max(0, x) / section.reach;
  return halfBeam * (1 - ratio ** section.exponent) ** (1 / section.exponent);
}

export interface AnchorSpot {
  /** Forward distance from the hull end. */
  x: number;
  /** Signed z of the hull surface under the anchor. */
  z: number;
  /** Rotation about Y that turns the anchor's +Z face to the hull's normal. */
  yaw: number;
}

/** Height the bow anchors hang at, in the middle of the black band. */
export const ANCHOR_Y = 0.75;

/** Where an anchor rests against the bow's side, for side = +1 or -1. */
export function bowAnchorSpot(
  bow: BowShape,
  length: number,
  halfBeam: number,
  side: 1 | -1
): AnchorSpot {
  const section = BOW_SECTIONS[bow](ANCHOR_Y, length);
  const x = section.reach * 0.45;
  const delta = 0.02;
  const width = hullHalfWidth(ANCHOR_Y, halfBeam);
  const flaredWidth = (at: number) =>
    halfWidthAt(section, width, at) * bowFlare(ANCHOR_Y, at / section.reach);
  const slope = (flaredWidth(x + delta) - flaredWidth(x - delta)) / (2 * delta);
  const normalX = -slope;
  const normalZ = side;
  return {
    x,
    z: side * flaredWidth(x),
    yaw: Math.atan2(normalX, normalZ),
  };
}
