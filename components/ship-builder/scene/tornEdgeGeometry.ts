import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Plane,
  Vector3,
} from "three";
import { BOOT_TOP, DECK_Y, HULL_DRAFT } from "./coords";
import { worldXOf } from "./halfTransform";
import { bandHeights, sectionProfile, type SectionPoint } from "./hullGeometry";
import { hullHalfWidth } from "./hullShapes";
import { DECK_PLATE, DECK_TOP } from "./hullTrim";
import type { HalfSide } from "./partHalves";
import { slotNoise } from "./particles";

/**
 * The ragged end of one half of a broken ship, built in the ship's own frame.
 *
 * The tear wanders along the hull within `TEAR_DEPTH` of the break. Each half
 * cuts its hull flat at its own edge of that band (see `clipXFor`) and fills
 * the band with torn plating: an outer skin in the hull's paint whose edge is
 * a sawtooth, a bright sliver where the steel ripped, a dark inner skin and
 * back wall so the inside reads as a hollow, and a few deck plates sticking
 * out past the tear. Both halves share one tear line, so at the moment of the
 * break their teeth interlock exactly and the hull looks whole.
 */

/** Width of the band the tear wanders across, centred on the break. */
export const TEAR_DEPTH = 0.4;
/** Thickness of the torn plating, and the inset of the dark inner skin. */
export const PLATE_SKIN = 0.06;
/** How far the dark inside reaches into the half from its cut. */
export const INNER_DEPTH = 0.7;
/** Most a deck plate sticks out past the far edge of the tear band. */
export const DECK_PLATE_REACH = 0.4;
/** How far a long tooth's tip curls outward, at the longest. */
const TOOTH_CURL = 0.07;
/** Average tooth width along the section's outline. */
const TOOTH_PITCH = 0.3;
const PLATE_THICKNESS = 0.05;
/** Points across a deck plate's ragged front edge. */
const PLATE_JAGS = 9;
/** Heights of the decks inside the hull; halves take alternate ones. */
const INNER_DECKS = [-1.05, -0.7, -0.35, 0.05, 0.4, 0.75] as const;

const STEEL_EDGE = "#a3a9b0";
const INNER_NEAR = "#24272d";
const INNER_FAR = "#0b0c0f";
const DECK_STEEL = "#4a4f57";

export interface TornEdgeColors {
  /** Antifouling, below the boot top. */
  bottom: string;
  topsides: string;
  deck: string;
}

export interface TornEdgeOptions {
  lengthCells: number;
  beam: number;
  /** Where she broke, cells from the bow. */
  atX: number;
  side: HalfSide;
  colors: TornEdgeColors;
}

/** +1 when the half lies toward +x (the bow), -1 for the stern. */
function directionOf(side: HalfSide): 1 | -1 {
  return side === "bow" ? 1 : -1;
}

/** World x of the break line, in the ship's frame. */
export function breakXOf(atX: number, lengthCells: number): number {
  return worldXOf(atX, lengthCells);
}

/** World x where this half's hull is cut flat (its edge of the tear band). */
export function clipXFor(side: HalfSide, breakX: number): number {
  return breakX + (directionOf(side) * TEAR_DEPTH) / 2;
}

/** The half's cut in its own frame: points beyond it are clipped away. */
export function localClipPlane(
  side: HalfSide,
  breakX: number,
  out: Plane = new Plane()
): Plane {
  const direction = directionOf(side);
  // Keeps the points with direction · (x - clipX) >= 0.
  return out.set(
    new Vector3(direction, 0, 0),
    -direction * clipXFor(side, breakX)
  );
}

/** A deterministic seed from the break position: no Math.random. */
function seedOf(atX: number): number {
  return Math.round(atX * 1000) / 97 + 3.7;
}

/** The closed outline of the hull's cross-section at the break, (y, z). */
export function crossSectionRing(halfBeam: number): SectionPoint[] {
  const heights = [
    ...bandHeights(-HULL_DRAFT, BOOT_TOP),
    ...bandHeights(BOOT_TOP, DECK_Y).slice(1),
  ];
  const sides = sectionProfile((y) => hullHalfWidth(y, halfBeam), heights);
  // Over the deck plate's rounded edge and back across its top.
  const deckEdge = halfBeam - DECK_PLATE;
  return [[DECK_TOP, deckEdge], ...sides, [DECK_TOP, -deckEdge]];
}

export interface TearPoint {
  y: number;
  z: number;
  /** Outward normal of the section here, in the (y, z) plane. */
  ny: number;
  nz: number;
  /** World x of the tear here: the bow keeps plating ahead of it. */
  x: number;
}

/** Distance along a closed (y, z) loop to each of its points. */
function arcLengths(ring: SectionPoint[]): number[] {
  const out = [0];
  for (let i = 1; i <= ring.length; i++) {
    const [y0, z0] = ring[i - 1];
    const [y1, z1] = ring[i % ring.length];
    out.push(out[i - 1] + Math.hypot(y1 - y0, z1 - z0));
  }
  return out;
}

function pointAtArc(
  ring: SectionPoint[],
  arcs: number[],
  s: number
): SectionPoint {
  let i = 0;
  while (i < ring.length - 1 && arcs[i + 1] < s) i++;
  const span = arcs[i + 1] - arcs[i];
  const t = span > 0 ? (s - arcs[i]) / span : 0;
  const [y0, z0] = ring[i];
  const [y1, z1] = ring[(i + 1) % ring.length];
  return [y0 + (y1 - y0) * t, z0 + (z1 - z0) * t];
}

/**
 * The sawtooth tear line round the section: teeth alternately reach toward
 * the bow and the stern, each a different width and depth. Samples land on
 * every corner of the section too, so the torn skin hugs the hull exactly.
 * Returned as an open list; the last point closes back to the first.
 */
export function tearLine(
  atX: number,
  lengthCells: number,
  beam: number
): TearPoint[] {
  const ring = crossSectionRing(beam / 2);
  const arcs = arcLengths(ring);
  const total = arcs[arcs.length - 1];
  const teeth = Math.max(4, Math.round(total / TOOTH_PITCH));
  const pitch = total / teeth;
  const seed = seedOf(atX);
  const breakX = breakXOf(atX, lengthCells);
  const half = TEAR_DEPTH / 2;

  // Each tooth: a valley toward the bow at its start, a peak toward the
  // stern somewhere in its middle. Offsets are from the break line.
  const keys: Array<{ s: number; offset: number }> = [];
  for (let k = 0; k < teeth; k++) {
    const valley = -half + TEAR_DEPTH * 0.3 * (slotNoise(k, seed) + 1) * 0.5;
    const peakAt = 0.5 + 0.18 * slotNoise(k, seed + 1);
    const peak = half - TEAR_DEPTH * 0.35 * (slotNoise(k, seed + 2) + 1) * 0.5;
    keys.push({ s: k * pitch, offset: valley });
    keys.push({ s: (k + peakAt) * pitch, offset: peak });
  }
  keys.push({ s: total, offset: keys[0].offset });

  const offsetAt = (s: number) => {
    let i = 0;
    while (i < keys.length - 2 && keys[i + 1].s < s) i++;
    const a = keys[i];
    const b = keys[i + 1];
    const t = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0;
    return a.offset + (b.offset - a.offset) * t;
  };

  const samples = [
    ...keys.slice(0, -1).map((key) => key.s),
    ...arcs.slice(0, -1),
  ]
    .sort((a, b) => a - b)
    .filter((s, i, all) => i === 0 || s - all[i - 1] > 1e-4);

  const centreY = (DECK_TOP - HULL_DRAFT) / 2;
  const points = samples.map((s) => pointAtArc(ring, arcs, s));
  return points.map(([y, z], i) => {
    const [yPrev, zPrev] = points[(i - 1 + points.length) % points.length];
    const [yNext, zNext] = points[(i + 1) % points.length];
    let ny = zNext - zPrev;
    let nz = -(yNext - yPrev);
    const length = Math.hypot(ny, nz) || 1;
    ny /= length;
    nz /= length;
    // The section is convex: outward points away from its middle.
    if (ny * (y - centreY) + nz * z < 0) {
      ny = -ny;
      nz = -nz;
    }
    return { y, z, ny, nz, x: breakX + offsetAt(samples[i]) };
  });
}

/** Collects vertices, per-vertex colours and triangles. */
class MeshBuilder {
  readonly positions: number[] = [];
  readonly colors: number[] = [];
  readonly indices: number[] = [];

  vertex(x: number, y: number, z: number, color: Color): number {
    this.positions.push(x, y, z);
    this.colors.push(color.r, color.g, color.b);
    return this.positions.length / 3 - 1;
  }

  quad(a: number, b: number, c: number, d: number) {
    this.indices.push(a, b, c, a, c, d);
  }

  /** Joins two equal-length rows of vertices into a closed band of quads. */
  band(from: number[], to: number[]) {
    for (let i = 0; i < from.length; i++) {
      const next = (i + 1) % from.length;
      this.quad(from[i], from[next], to[next], to[i]);
    }
  }

  build(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(this.positions, 3)
    );
    geometry.setAttribute("color", new Float32BufferAttribute(this.colors, 3));
    geometry.setIndex(this.indices);
    geometry.computeVertexNormals();
    return geometry;
  }
}

/** The paint a torn plate shows at height y. */
function paintAt(y: number, paints: Record<keyof TornEdgeColors, Color>) {
  if (y > DECK_Y + 1e-3) return paints.deck;
  return y >= BOOT_TOP - 1e-3 ? paints.topsides : paints.bottom;
}

/** One ragged deck plate jutting out of the hull's inside. */
function addDeckPlate(
  mesh: MeshBuilder,
  y: number,
  halfWidth: number,
  backX: number,
  frontX: (jag: number) => number,
  colors: { top: Color; edge: Color }
) {
  const top = y + PLATE_THICKNESS / 2;
  const bottom = y - PLATE_THICKNESS / 2;
  const upper = { back: [] as number[], front: [] as number[] };
  const under = { back: [] as number[], front: [] as number[] };
  const edge = { top: [] as number[], bottom: [] as number[] };
  for (let j = 0; j < PLATE_JAGS; j++) {
    const z = -halfWidth + (2 * halfWidth * j) / (PLATE_JAGS - 1);
    const x = frontX(j);
    upper.back.push(mesh.vertex(backX, top, z, colors.top));
    upper.front.push(mesh.vertex(x, top, z, colors.top));
    under.back.push(mesh.vertex(backX, bottom, z, colors.top));
    under.front.push(mesh.vertex(x, bottom, z, colors.top));
    edge.top.push(mesh.vertex(x, top, z, colors.edge));
    edge.bottom.push(mesh.vertex(x, bottom, z, colors.edge));
  }
  for (let j = 0; j < PLATE_JAGS - 1; j++) {
    const k = j + 1;
    mesh.quad(upper.back[j], upper.back[k], upper.front[k], upper.front[j]);
    mesh.quad(under.back[j], under.back[k], under.front[k], under.front[j]);
    mesh.quad(edge.top[j], edge.top[k], edge.bottom[k], edge.bottom[j]);
  }
}

/** The decks this half shows: alternate heights, two or three of them. */
function deckHeightsFor(side: HalfSide, seed: number): number[] {
  const offset = side === "bow" ? 0 : 1;
  const mine = INNER_DECKS.filter((_, i) => i % 2 === offset);
  // Now and then one is missing, so the two halves differ.
  return slotNoise(offset, seed + 7) > 0.2 ? mine.slice(0, 2) : mine;
}

/**
 * Builds the torn end of one half (see the file comment). Colours are baked
 * in as vertex colours so the whole edge is one draw call.
 */
export function buildTornEdgeGeometry(
  options: TornEdgeOptions
): BufferGeometry {
  const { lengthCells, beam, atX, side } = options;
  const direction = directionOf(side);
  const breakX = breakXOf(atX, lengthCells);
  const clipX = clipXFor(side, breakX);
  const backX = clipX + direction * INNER_DEPTH;
  const seed = seedOf(atX);
  const paints = {
    bottom: new Color(options.colors.bottom),
    topsides: new Color(options.colors.topsides),
    deck: new Color(options.colors.deck),
  };
  const steel = new Color(STEEL_EDGE);
  const innerNear = new Color(INNER_NEAR);
  const innerFar = new Color(INNER_FAR);
  const mesh = new MeshBuilder();

  const tear = tearLine(atX, lengthCells, beam);
  const outerTip: number[] = [];
  const outerCut: number[] = [];
  const edgeOuter: number[] = [];
  const edgeInner: number[] = [];
  const innerTip: number[] = [];
  const innerBack: number[] = [];
  const backRing: number[] = [];

  for (const point of tear) {
    const { y, z, ny, nz } = point;
    // How far this tooth sticks out from the half's cut, 0 to 1.
    const reach = Math.abs(clipX - point.x) / TEAR_DEPTH;
    const curl = TOOTH_CURL * reach * reach;
    const tipY = y + ny * curl;
    const tipZ = z + nz * curl;
    const paint = paintAt(y, paints);
    outerTip.push(mesh.vertex(point.x, tipY, tipZ, paint));
    outerCut.push(mesh.vertex(clipX, y, z, paint));

    const inY = y - ny * PLATE_SKIN;
    const inZ = z - nz * PLATE_SKIN;
    const inTipY = tipY - ny * PLATE_SKIN;
    const inTipZ = tipZ - nz * PLATE_SKIN;
    edgeOuter.push(mesh.vertex(point.x, tipY, tipZ, steel));
    edgeInner.push(mesh.vertex(point.x, inTipY, inTipZ, steel));
    innerTip.push(mesh.vertex(point.x, inTipY, inTipZ, innerNear));
    innerBack.push(mesh.vertex(backX, inY, inZ, innerFar));
    backRing.push(mesh.vertex(backX, inY, inZ, innerFar));
  }

  mesh.band(outerTip, outerCut);
  mesh.band(edgeOuter, edgeInner);
  mesh.band(innerTip, innerBack);

  // The back wall closes the hollow, fanned from the section's middle.
  const centre = mesh.vertex(backX, (DECK_TOP - HULL_DRAFT) / 2, 0, innerFar);
  for (let i = 0; i < backRing.length; i++) {
    const next = (i + 1) % backRing.length;
    mesh.indices.push(centre, backRing[i], backRing[next]);
  }

  const plateColors = { top: new Color(DECK_STEEL), edge: steel };
  deckHeightsFor(side, seed).forEach((y, plate) => {
    const halfWidth = hullHalfWidth(y, beam / 2) - PLATE_SKIN * 1.5;
    if (halfWidth <= 0) return;
    const farEdge = breakX - direction * (TEAR_DEPTH / 2);
    addDeckPlate(
      mesh,
      y,
      halfWidth,
      backX,
      (jag) => {
        const noise = (slotNoise(jag + plate * 31, seed + 11) + 1) / 2;
        // Every other point pulls back, so the front edge is a sawtooth.
        const pull = jag % 2 === 0 ? 0.25 + 0.75 * noise : 0.6 * noise;
        return farEdge - direction * DECK_PLATE_REACH * (1 - pull);
      },
      plateColors
    );
  });

  return mesh.build();
}
