import { Box3 } from "three";
import type { BufferGeometry } from "three";
import {
  buildLifeboatGeometry,
  getLifeboatGeometry,
  halfBeamAt,
} from "../lifeboatGeometry";

const DIMS = { length: 0.9, width: 0.35, depth: 0.3, coverHeight: 0.08 };

function bounds(geometry: BufferGeometry): Box3 {
  return new Box3().setFromBufferAttribute(
    geometry.getAttribute("position") as never
  );
}

function hasNoNaN(geometry: BufferGeometry): boolean {
  return ["position", "normal"].every((name) =>
    Array.from(geometry.getAttribute(name).array).every(Number.isFinite)
  );
}

describe("lifeboat loft", () => {
  const { hull, cover, trim } = buildLifeboatGeometry(DIMS);

  it("keeps the old outer size for the hull", () => {
    const box = bounds(hull);
    expect(box.max.x - box.min.x).toBeCloseTo(DIMS.length, 5);
    expect(box.max.z - box.min.z).toBeCloseTo(DIMS.width, 2);
    expect(box.min.y).toBeCloseTo(-DIMS.depth, 2);
    // A slight sheer lifts the ends a little above the old rim.
    expect(box.max.y).toBeGreaterThan(0);
    expect(box.max.y).toBeLessThan(DIMS.depth * 0.2);
  });

  it("keeps the cover and trim within a hair of the hull", () => {
    const hullBox = bounds(hull);
    const coverBox = bounds(cover);
    expect(coverBox.max.z).toBeLessThanOrEqual(hullBox.max.z);
    expect(coverBox.max.y - hullBox.max.y).toBeLessThan(
      DIMS.coverHeight + 0.01
    );
    const trimBox = bounds(trim);
    expect(trimBox.max.x - trimBox.min.x).toBeLessThan(DIMS.length + 0.06);
    expect(trimBox.max.z - trimBox.min.z).toBeLessThan(DIMS.width + 0.06);
  });

  it("has no NaN in any attribute", () => {
    for (const geometry of [hull, cover, trim]) {
      expect(hasNoNaN(geometry)).toBe(true);
    }
  });

  it("points the bow (+X) and rounds the stern (-X)", () => {
    expect(halfBeamAt(1, DIMS.width)).toBeCloseTo(0, 5);
    expect(halfBeamAt(0, DIMS.width)).toBeCloseTo(0, 5);
    // The stern is fuller than the bow just inside their tips.
    expect(halfBeamAt(0.1, DIMS.width)).toBeGreaterThan(
      halfBeamAt(0.9, DIMS.width)
    );
    expect(halfBeamAt(0.55, DIMS.width)).toBeCloseTo(DIMS.width / 2, 5);
  });

  it("faces the hull's keel downward and the cover's top upward", () => {
    const keelNormals = hull.getAttribute("normal");
    const keel = hull.getAttribute("position");
    let lowest = 0;
    for (let i = 1; i < keel.count; i++) {
      if (keel.getY(i) < keel.getY(lowest)) lowest = i;
    }
    expect(keelNormals.getY(lowest)).toBeLessThan(0);

    const top = cover.getAttribute("position");
    const topNormals = cover.getAttribute("normal");
    let highest = 0;
    for (let i = 1; i < top.count; i++) {
      if (top.getY(i) > top.getY(highest)) highest = i;
    }
    expect(topNormals.getY(highest)).toBeGreaterThan(0);
  });

  it("shares one geometry set per boat size", () => {
    expect(getLifeboatGeometry(DIMS)).toBe(getLifeboatGeometry({ ...DIMS }));
    expect(getLifeboatGeometry(DIMS)).not.toBe(
      getLifeboatGeometry({ ...DIMS, length: 1.9 })
    );
  });
});
