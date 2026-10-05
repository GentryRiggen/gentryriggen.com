import { BufferGeometry, Float32BufferAttribute } from "three";
import { bilgeHeights, endOutline, type EndSection } from "./hullShapes";

const ROW_HEIGHT = 0.3;
/** Rows closer than this are merged, so no sliver triangles appear. */
const MIN_ROW_GAP = 0.04;

/**
 * The heights a band is sliced at: the old even rows plus the bilge arc's own
 * samples. The middle section and both ends use the same list, so their
 * vertices line up exactly and the seams stay closed.
 */
export function bandHeights(bottom: number, top: number): number[] {
  const rowCount = Math.max(1, Math.ceil((top - bottom) / ROW_HEIGHT));
  const candidates = [
    ...Array.from(
      { length: rowCount - 1 },
      (_, i) => bottom + ((top - bottom) * (i + 1)) / rowCount
    ),
    ...bilgeHeights().filter((y) => y > bottom && y < top),
  ].sort((a, b) => a - b);

  const heights = [bottom];
  for (const y of candidates) {
    const isClearOfBottom = y - heights[heights.length - 1] >= MIN_ROW_GAP;
    const isClearOfTop = top - y >= MIN_ROW_GAP;
    if (isClearOfBottom && isClearOfTop) heights.push(y);
  }
  heights.push(top);
  return heights;
}

export interface MiddleGeometryOptions {
  /** The cross-section's half-width at a world height. */
  halfWidthAt: (y: number) => number;
  /** Slice heights, bottom to top (see `bandHeights`). */
  heights: number[];
  /** Length along x, centred on the origin. */
  length: number;
  hasBottomCap: boolean;
  hasTopCap: boolean;
}

/** A point on the hull's cross-section: world height, then signed width. */
export type SectionPoint = [y: number, z: number];

/**
 * The cross-section as (y, z) points: down the +z side from the top height to
 * the bottom one, then up the -z side. The middle section is this profile
 * extruded; the torn edge of a broken ship follows it too.
 */
export function sectionProfile(
  halfWidthAt: (y: number) => number,
  heights: number[]
): SectionPoint[] {
  return [
    ...[...heights].reverse().map((y): SectionPoint => [y, halfWidthAt(y)]),
    ...heights.map((y): SectionPoint => [y, -halfWidthAt(y)]),
  ];
}

/**
 * Extrudes the shared cross-section along x. Rings run down the +z side,
 * across the bottom and up the -z side, so every ring point has an end-loft
 * twin at the same height and width.
 */
export function buildMiddleGeometry(
  options: MiddleGeometryOptions
): BufferGeometry {
  const { halfWidthAt, heights, length, hasBottomCap, hasTopCap } = options;
  const profile = sectionProfile(halfWidthAt, heights);
  const sideCount = heights.length;

  const positions: number[] = [];
  for (const [y, z] of profile) {
    positions.push(-length / 2, y, z, length / 2, y, z);
  }

  const indices: number[] = [];
  const addQuad = (k: number, next: number) => {
    const a = k * 2;
    const b = a + 1;
    const c = next * 2;
    const d = c + 1;
    indices.push(a, c, b, b, c, d);
  };
  for (let k = 0; k < profile.length - 1; k++) {
    const isBottomJoin = k === sideCount - 1;
    if (isBottomJoin && !hasBottomCap) continue;
    addQuad(k, k + 1);
  }
  if (hasTopCap) addQuad(profile.length - 1, 0);

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export interface EndGeometryOptions {
  /** The slice shape at a world height. */
  sectionAt: (y: number) => EndSection;
  /** The cross-section's half-width at a world height. */
  halfWidthAt: (y: number) => number;
  /**
   * Optional extra scaling of a slice's width at a world height, given how far
   * along the reach each point is (0 at the hull end, 1 at the tip).
   */
  flare?: (y: number, reachFraction: number) => number;
  /** Slice heights, bottom to top (see `bandHeights`). */
  heights: number[];
  /** World x of the hull end the solid grows from. */
  originX: number;
  /** A stern grows toward -x and is wound the other way round. */
  isStern: boolean;
  hasBottomCap: boolean;
  hasTopCap: boolean;
}

/**
 * Lofts a hull end through the given heights. Slices are evaluated at the
 * exact band edges, so two bands sharing an edge meet with no gap or step,
 * and the first ring of every slice is the middle section's own cross-section.
 */
export function buildEndGeometry(options: EndGeometryOptions): BufferGeometry {
  const { sectionAt, halfWidthAt, flare, heights, originX, isStern } = options;
  const direction = isStern ? -1 : 1;
  const rowCount = heights.length - 1;
  const positions: number[] = [];
  const indices: number[] = [];

  const rings: number[][][] = heights.map((y) => {
    const section = sectionAt(y);
    return endOutline(section, halfWidthAt(y)).map(([x, z]) => [
      originX + direction * x,
      y,
      flare ? z * flare(y, x / section.reach) : z,
    ]);
  });
  const ringSize = rings[0].length;

  for (const ring of rings) for (const point of ring) positions.push(...point);

  // Winding is outward for a bow; mirroring in x reverses it for a stern.
  const push = (a: number, b: number, c: number) =>
    isStern ? indices.push(a, c, b) : indices.push(a, b, c);

  for (let row = 0; row < rowCount; row++) {
    for (let k = 0; k < ringSize - 1; k++) {
      const a = row * ringSize + k;
      const b = a + 1;
      const c = a + ringSize;
      const d = c + 1;
      push(a, b, c);
      push(b, d, c);
    }
  }

  const addCap = (row: number, isUp: boolean) => {
    const centre = positions.length / 3;
    positions.push(originX, rings[row][0][1], 0);
    const first = positions.length / 3;
    for (const point of rings[row]) positions.push(...point);
    for (let k = 0; k < ringSize - 1; k++) {
      if (isUp) push(centre, first + k, first + k + 1);
      else push(centre, first + k + 1, first + k);
    }
  };
  if (options.hasBottomCap) addCap(0, false);
  if (options.hasTopCap) addCap(rowCount, true);

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
