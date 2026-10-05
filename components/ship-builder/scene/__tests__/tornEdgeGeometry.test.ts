import { Vector3, type BufferGeometry } from "three";
import { DECK_Y, HULL_DRAFT } from "../coords";
import { hullHalfWidth } from "../hullShapes";
import { DECK_TOP } from "../hullTrim";
import {
  breakXOf,
  buildTornEdgeGeometry,
  clipXFor,
  crossSectionRing,
  DECK_PLATE_REACH,
  INNER_DEPTH,
  localClipPlane,
  TEAR_DEPTH,
  tearLine,
  type TornEdgeOptions,
} from "../tornEdgeGeometry";

const BASE: TornEdgeOptions = {
  lengthCells: 32,
  beam: 4,
  atX: 19,
  side: "bow",
  colors: { bottom: "#8e2a22", topsides: "#15171a", deck: "#c9a878" },
};

function positionsOf(geometry: BufferGeometry): number[] {
  return Array.from(geometry.getAttribute("position").array);
}

function xsOf(geometry: BufferGeometry): number[] {
  return positionsOf(geometry).filter((_, i) => i % 3 === 0);
}

describe("crossSectionRing", () => {
  it("follows the hull's own half-width from keel to deck", () => {
    const ring = crossSectionRing(2);
    const sides = ring.filter(([y]) => y <= DECK_Y);
    expect(sides.length).toBeGreaterThan(10);
    for (const [y, z] of sides) {
      expect(Math.abs(z)).toBeCloseTo(hullHalfWidth(y, 2), 10);
    }
    const ys = ring.map(([y]) => y);
    expect(Math.min(...ys)).toBeCloseTo(-HULL_DRAFT, 10);
    expect(Math.max(...ys)).toBeCloseTo(DECK_TOP, 10);
  });
});

describe("tearLine", () => {
  const breakX = breakXOf(BASE.atX, BASE.lengthCells);
  const line = tearLine(BASE.atX, BASE.lengthCells, BASE.beam);

  it("wanders within the tear band, reaching toward both ends", () => {
    const offsets = line.map((point) => point.x - breakX);
    for (const offset of offsets) {
      expect(Math.abs(offset)).toBeLessThanOrEqual(TEAR_DEPTH / 2 + 1e-9);
    }
    expect(Math.min(...offsets)).toBeLessThan(-TEAR_DEPTH / 4);
    expect(Math.max(...offsets)).toBeGreaterThan(TEAR_DEPTH / 4);
  });

  it("is a sawtooth, not a straight cut", () => {
    const offsets = line.map((point) => point.x - breakX);
    let turns = 0;
    for (let i = 1; i < offsets.length - 1; i++) {
      const before = offsets[i] - offsets[i - 1];
      const after = offsets[i + 1] - offsets[i];
      if (before * after < 0) turns += 1;
    }
    expect(turns).toBeGreaterThan(20);
  });

  it("has unit outward normals", () => {
    for (const { y, z, ny, nz } of line) {
      expect(Math.hypot(ny, nz)).toBeCloseTo(1, 10);
      const centreY = (DECK_TOP - HULL_DRAFT) / 2;
      expect(ny * (y - centreY) + nz * z).toBeGreaterThan(0);
    }
  });

  it("is the same every time for one break and different for another", () => {
    expect(tearLine(BASE.atX, BASE.lengthCells, BASE.beam)).toEqual(line);
    const other = tearLine(BASE.atX + 1, BASE.lengthCells, BASE.beam);
    const shifted = other.map((point) => point.x + 1);
    expect(shifted).not.toEqual(line.map((point) => point.x));
  });
});

describe("clip planes", () => {
  const breakX = breakXOf(BASE.atX, BASE.lengthCells);

  it("cuts each half at its own edge of the tear band", () => {
    expect(clipXFor("bow", breakX)).toBeCloseTo(breakX + TEAR_DEPTH / 2);
    expect(clipXFor("stern", breakX)).toBeCloseTo(breakX - TEAR_DEPTH / 2);
  });

  it("keeps the bow ahead of its cut and the stern behind", () => {
    const bow = localClipPlane("bow", breakX);
    const stern = localClipPlane("stern", breakX);
    const ahead = new Vector3(breakX + 1, 0, 0);
    const behind = new Vector3(breakX - 1, 0, 0);
    expect(bow.distanceToPoint(ahead)).toBeGreaterThan(0);
    expect(bow.distanceToPoint(behind)).toBeLessThan(0);
    expect(stern.distanceToPoint(behind)).toBeGreaterThan(0);
    expect(stern.distanceToPoint(ahead)).toBeLessThan(0);
  });
});

describe("buildTornEdgeGeometry", () => {
  const breakX = breakXOf(BASE.atX, BASE.lengthCells);

  it.each(["bow", "stern"] as const)("builds a %s edge with no NaN", (side) => {
    const geometry = buildTornEdgeGeometry({ ...BASE, side });
    const positions = positionsOf(geometry);
    expect(positions.length).toBeGreaterThan(0);
    expect(positions.every(Number.isFinite)).toBe(true);
    const colors = Array.from(geometry.getAttribute("color").array);
    expect(colors.length).toBe(positions.length);
    expect(colors.every((c) => c >= 0 && c <= 1)).toBe(true);
    expect(geometry.getIndex()?.count ?? 0).toBeGreaterThan(0);
  });

  it("keeps every vertex near the break, reaching into its own half", () => {
    const reach = TEAR_DEPTH / 2 + DECK_PLATE_REACH + 1e-6;
    const depth = TEAR_DEPTH / 2 + INNER_DEPTH + 1e-6;
    const bow = xsOf(buildTornEdgeGeometry({ ...BASE, side: "bow" }));
    expect(Math.min(...bow)).toBeGreaterThanOrEqual(breakX - reach);
    expect(Math.max(...bow)).toBeLessThanOrEqual(breakX + depth);
    const stern = xsOf(buildTornEdgeGeometry({ ...BASE, side: "stern" }));
    expect(Math.min(...stern)).toBeGreaterThanOrEqual(breakX - depth);
    expect(Math.max(...stern)).toBeLessThanOrEqual(breakX + reach);
  });

  it("mirrors the halves: their edges reach equally far each way", () => {
    const bow = xsOf(buildTornEdgeGeometry({ ...BASE, side: "bow" }));
    const stern = xsOf(buildTornEdgeGeometry({ ...BASE, side: "stern" }));
    expect(Math.max(...bow) - breakX).toBeCloseTo(
      breakX - Math.min(...stern),
      6
    );
  });

  it("stays inside the hull's beam, give or take a curled tooth", () => {
    const positions = positionsOf(buildTornEdgeGeometry(BASE));
    for (let i = 0; i < positions.length; i += 3) {
      expect(Math.abs(positions[i + 2])).toBeLessThanOrEqual(
        BASE.beam / 2 + 0.1
      );
      expect(positions[i + 1]).toBeGreaterThanOrEqual(-HULL_DRAFT - 0.1);
      expect(positions[i + 1]).toBeLessThanOrEqual(DECK_TOP + 0.1);
    }
  });

  it("is deterministic", () => {
    expect(positionsOf(buildTornEdgeGeometry(BASE))).toEqual(
      positionsOf(buildTornEdgeGeometry(BASE))
    );
  });
});
