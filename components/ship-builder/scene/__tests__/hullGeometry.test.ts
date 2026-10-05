import type { BufferGeometry } from "three";
import { BOW_IDS, STERN_IDS } from "@/lib/ship-builder/model/types";
import { bowLength, sternLength } from "@/lib/ship-builder/model/hullEnds";
import { BOOT_TOP, DECK_Y, HULL_DRAFT } from "../coords";
import {
  bandHeights,
  buildEndGeometry,
  buildMiddleGeometry,
} from "../hullGeometry";
import {
  BILGE_RADIUS,
  bowAnchorSpot,
  bowFlare,
  endSectionAt,
  halfWidthAt,
  hullHalfWidth,
} from "../hullShapes";
import {
  buildBulwarkGeometry,
  buildHullBand,
  makeSheer,
  type HullPlan,
} from "../hullTrim";

const HALF_BEAM = 2;
const LENGTH = 8;

function positionsOf(geometry: BufferGeometry): number[] {
  return Array.from(geometry.getAttribute("position").array);
}

function bounds(geometry: BufferGeometry) {
  geometry.computeBoundingBox();
  return geometry.boundingBox!;
}

function buildMiddle(bottom: number, top: number) {
  return buildMiddleGeometry({
    halfWidthAt: (y) => hullHalfWidth(y, HALF_BEAM),
    heights: bandHeights(bottom, top),
    length: LENGTH,
    hasBottomCap: bottom === -HULL_DRAFT,
    hasTopCap: false,
  });
}

function buildEnd(
  kind: "bow" | "stern",
  shape: string,
  bottom: number,
  top: number
) {
  const length =
    kind === "bow" ? bowLength(shape as never) : sternLength(shape as never);
  return buildEndGeometry({
    sectionAt: (y) => endSectionAt(kind, shape as never, length, y),
    halfWidthAt: (y) => hullHalfWidth(y, HALF_BEAM),
    flare: kind === "bow" ? bowFlare : undefined,
    heights: bandHeights(bottom, top),
    originX: ((kind === "bow" ? 1 : -1) * LENGTH) / 2,
    isStern: kind === "stern",
    hasBottomCap: bottom === -HULL_DRAFT,
    hasTopCap: false,
  });
}

describe("hullHalfWidth", () => {
  it("is the full half-beam above the bilge", () => {
    expect(hullHalfWidth(DECK_Y, HALF_BEAM)).toBe(HALF_BEAM);
    expect(hullHalfWidth(0, HALF_BEAM)).toBe(HALF_BEAM);
  });

  it("rolls in to a flat keel one bilge radius narrower", () => {
    expect(hullHalfWidth(-HULL_DRAFT, HALF_BEAM)).toBeCloseTo(
      HALF_BEAM - BILGE_RADIUS
    );
  });

  it("narrows monotonically toward the keel", () => {
    let previous = Infinity;
    for (let y = DECK_Y; y >= -HULL_DRAFT; y -= 0.1) {
      const width = hullHalfWidth(y, HALF_BEAM);
      expect(width).toBeLessThanOrEqual(previous + 1e-9);
      previous = width;
    }
  });
});

describe("bandHeights", () => {
  it("starts and ends exactly on the band edges, ascending", () => {
    const heights = bandHeights(-HULL_DRAFT, BOOT_TOP);
    expect(heights[0]).toBe(-HULL_DRAFT);
    expect(heights[heights.length - 1]).toBe(BOOT_TOP);
    heights.slice(1).forEach((y, i) => expect(y).toBeGreaterThan(heights[i]));
  });

  it("adds rows around the bilge so it reads round", () => {
    expect(bandHeights(-HULL_DRAFT, BOOT_TOP).length).toBeGreaterThan(8);
  });
});

describe("middle section", () => {
  it("keeps the old outer size at deck level and the keel's bilge", () => {
    const box = bounds(buildMiddle(BOOT_TOP, DECK_Y));
    expect(box.min.x).toBeCloseTo(-LENGTH / 2);
    expect(box.max.x).toBeCloseTo(LENGTH / 2);
    expect(box.max.z).toBeCloseTo(HALF_BEAM);
    expect(box.min.z).toBeCloseTo(-HALF_BEAM);
    expect(box.min.y).toBeCloseTo(BOOT_TOP);
    expect(box.max.y).toBeCloseTo(DECK_Y);

    const keel = bounds(buildMiddle(-HULL_DRAFT, BOOT_TOP));
    expect(keel.min.y).toBeCloseTo(-HULL_DRAFT);
    expect(keel.max.z).toBeCloseTo(HALF_BEAM);
  });

  it("has no NaN and faces outward", () => {
    const geometry = buildMiddle(-HULL_DRAFT, BOOT_TOP);
    expect(positionsOf(geometry).every(Number.isFinite)).toBe(true);
    const normals = geometry.getAttribute("normal");
    const positions = geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      const outward =
        normals.getY(i) * (positions.getY(i) - -0.4) +
        normals.getZ(i) * positions.getZ(i);
      expect(outward).toBeGreaterThan(0);
    }
  });
});

describe("end lofts", () => {
  const cases = BOW_IDS.map((shape) => ["bow", shape] as const).concat(
    STERN_IDS.map((shape) => ["stern", shape] as never)
  );

  it.each(cases)("has no NaN for the %s %s", (kind, shape) => {
    const geometry = buildEnd(kind, shape, -HULL_DRAFT, DECK_Y);
    expect(positionsOf(geometry).every(Number.isFinite)).toBe(true);
    expect(bounds(geometry).max.z).toBeLessThanOrEqual(HALF_BEAM + 1e-9);
  });

  it.each(cases)(
    "meets the middle section's rings exactly for the %s %s",
    (kind, shape) => {
      const middle = buildMiddle(-HULL_DRAFT, BOOT_TOP);
      const end = buildEnd(kind, shape, -HULL_DRAFT, BOOT_TOP);
      const edgeX = ((kind === "bow" ? 1 : -1) * LENGTH) / 2;
      const key = (x: number, y: number, z: number) =>
        [x, y, z].map((n) => n.toFixed(5)).join(":");
      const middleRing = new Set<string>();
      const mp = middle.getAttribute("position");
      for (let i = 0; i < mp.count; i++) {
        if (Math.abs(mp.getX(i) - edgeX) < 1e-9) {
          middleRing.add(key(edgeX, mp.getY(i), mp.getZ(i)));
        }
      }
      const ep = end.getAttribute("position");
      const heights = new Set(bandHeights(-HULL_DRAFT, BOOT_TOP));
      let joined = 0;
      for (let i = 0; i < ep.count; i++) {
        const isOnEdge = Math.abs(Math.abs(ep.getX(i)) - LENGTH / 2) < 1e-6;
        if (!isOnEdge || Math.abs(ep.getZ(i)) < 1e-9) continue;
        if (![...heights].some((y) => Math.abs(y - ep.getY(i)) < 1e-9))
          continue;
        // Cap centres sit on the centreline; every other edge point must have
        // a twin in the middle section.
        if (Math.abs(ep.getZ(i)) > 1e-6) {
          expect(middleRing.has(key(edgeX, ep.getY(i), ep.getZ(i)))).toBe(true);
          joined++;
        }
      }
      expect(joined).toBeGreaterThan(0);
    }
  );

  it("widens the bow toward the deck", () => {
    expect(bowFlare(DECK_Y, 0.5)).toBe(1);
    expect(bowFlare(0, 0.5)).toBeLessThan(1);
    expect(bowFlare(0, 0)).toBe(1);
  });
});

describe("bow anchors", () => {
  it.each([...BOW_IDS])("sit on the flared hull surface for %s", (bow) => {
    const spot = bowAnchorSpot(bow, bowLength(bow), HALF_BEAM, 1);
    const section = endSectionAt("bow", bow, bowLength(bow), 0.75);
    const surface =
      halfWidthAt(section, HALF_BEAM, spot.x) *
      bowFlare(0.75, spot.x / section.reach);
    expect(spot.z).toBeCloseTo(surface);
  });
});

describe("trim", () => {
  const plan: HullPlan = {
    lengthCells: LENGTH,
    beam: HALF_BEAM * 2,
    bow: "straight",
    stern: "counter",
  };

  it("rises from flush amidships to the bow and stern peaks", () => {
    const sheer = makeSheer(plan);
    expect(sheer(0)).toBe(0);
    expect(sheer(LENGTH / 2 - 1)).toBe(0);
    const bowTip = sheer(LENGTH / 2 + bowLength("straight"));
    const sternTip = sheer(-LENGTH / 2 - sternLength("counter"));
    expect(bowTip).toBeCloseTo(0.35);
    expect(sternTip).toBeCloseTo(0.2);
  });

  it("builds a bulwark above a flat deck without NaN", () => {
    const geometry = buildBulwarkGeometry(plan);
    expect(positionsOf(geometry).every(Number.isFinite)).toBe(true);
    const box = bounds(geometry);
    expect(box.min.y).toBeCloseTo(DECK_Y);
    expect(box.max.y).toBeGreaterThan(DECK_Y + 0.35);
    expect(box.max.z).toBeLessThan(HALF_BEAM + 0.01);
  });

  it("wraps trim bands round the hull without NaN", () => {
    const geometry = buildHullBand(plan, [
      { y: 0.3, out: 0.01 },
      { y: 0.4, out: 0.02 },
    ]);
    expect(positionsOf(geometry).every(Number.isFinite)).toBe(true);
    expect(bounds(geometry).max.z).toBeCloseTo(HALF_BEAM + 0.02, 1);
  });
});
