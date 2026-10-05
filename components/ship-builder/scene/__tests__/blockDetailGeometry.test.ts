import type { BufferGeometry } from "three";
import {
  BRIDGE_WINDOW_ROWS,
  buildWindowGeometries,
  CABIN_WINDOW_ROWS,
  trimBand,
} from "../blockDetailGeometry";

function bounds(geometry: BufferGeometry) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  return { min: box.min, max: box.max };
}

function allOf(g: ReturnType<typeof buildWindowGeometries>): BufferGeometry[] {
  return [g.glass, g.litGlass, g.litHalo, g.frames].filter(
    (geometry): geometry is BufferGeometry => geometry !== null
  );
}

function triangleCount(geometry: BufferGeometry): number {
  return (geometry.index?.count ?? 0) / 3;
}

describe("buildWindowGeometries", () => {
  it("merges a cabin's windows into at most four geometries", () => {
    const g = buildWindowGeometries(
      { x: 1, z: 1 },
      CABIN_WINDOW_ROWS,
      (i) => i % 2 === 0
    );
    expect(allOf(g).length).toBeLessThanOrEqual(4);
    expect(g.glass).not.toBeNull();
    expect(g.litGlass).not.toBeNull();
    expect(g.litHalo).not.toBeNull();
  });

  it("gives every pane a frame ring and sill (4 boxes each)", () => {
    const g = buildWindowGeometries({ x: 1, z: 1 }, CABIN_WINDOW_ROWS);
    const panes = 4 * 2;
    // 12 triangles per box: head, two sides and a sill per pane.
    expect(triangleCount(g.frames)).toBe(panes * 4 * 12);
    expect(triangleCount(g.glass!)).toBe(panes * 12);
    expect(g.litGlass).toBeNull();
    expect(g.litHalo).toBeNull();
  });

  it("sends a pane to the lit group, with a halo, only when it is lit", () => {
    const g = buildWindowGeometries(
      { x: 1, z: 1 },
      CABIN_WINDOW_ROWS,
      (i) => i < 3
    );
    expect(triangleCount(g.litGlass!)).toBe(3 * 12);
    expect(triangleCount(g.litHalo!)).toBe(3 * 12);
    expect(triangleCount(g.glass!)).toBe(5 * 12);
  });

  it("keeps cabin windows on the face, clear of the rounded corners", () => {
    const g = buildWindowGeometries({ x: 1, z: 1 }, CABIN_WINDOW_ROWS);
    for (const geometry of allOf(g)) {
      const { min, max } = bounds(geometry);
      expect(Math.abs(min.x)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(max.x)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(min.z)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(max.z)).toBeLessThanOrEqual(0.5);
      expect(min.y).toBeGreaterThan(0.06);
      expect(max.y).toBeLessThan(0.94);
    }
  });

  it("keeps wider blocks' windows within the face length", () => {
    const g = buildWindowGeometries({ x: 3, z: 2 }, CABIN_WINDOW_ROWS);
    const { min, max } = bounds(g.frames);
    expect(max.x).toBeLessThanOrEqual(3 * 0.48 + 0.04);
    expect(min.x).toBeGreaterThanOrEqual(-(3 * 0.48 + 0.04));
    expect(max.z).toBeLessThanOrEqual(2 * 0.48 + 0.04);
  });

  it("lays a dark band and roof wings on a bridge within its footprint", () => {
    const size = { x: 2, z: 5 };
    const g = buildWindowGeometries(size, BRIDGE_WINDOW_ROWS, () => true, 0.8);
    expect(allOf(g).length).toBeLessThanOrEqual(4);
    // Every pane is lit; the band is all that is left in the dark glass.
    expect(g.glass).not.toBeNull();
    const { min, max } = bounds(g.frames);
    expect(max.z).toBeLessThanOrEqual(size.z * 0.5 + 1e-6);
    expect(min.z).toBeGreaterThanOrEqual(-size.z * 0.5 - 1e-6);
    expect(max.y).toBeLessThanOrEqual(0.8);
  });
});

describe("trimBand", () => {
  it("hugs the body just proud of it, centred on the origin", () => {
    const { min, max } = bounds(trimBand({ x: 2, z: 1 }, 0.07));
    expect(max.x).toBeCloseTo(2 * 0.48 + 0.0075, 4);
    expect(max.z).toBeCloseTo(0.48 + 0.0075, 4);
    expect(min.x).toBeCloseTo(-max.x, 4);
    expect(max.y).toBeCloseTo(0.035, 4);
    expect(min.y).toBeCloseTo(-0.035, 4);
  });

  it("is shared per size", () => {
    expect(trimBand({ x: 1, z: 1 }, 0.03)).toBe(trimBand({ x: 1, z: 1 }, 0.03));
  });

  it("stays within the body's rounded corner, concentric with it", () => {
    const position = trimBand({ x: 1, z: 1 }, 0.03).getAttribute("position");
    // The body's vertical edge arc: centre (0.42, 0.42), radius 0.06.
    for (let i = 0; i < position.count; i++) {
      const x = Math.abs(position.getX(i));
      const z = Math.abs(position.getZ(i));
      if (x > 0.42 && z > 0.42) {
        const distance = Math.hypot(x - 0.42, z - 0.42);
        expect(distance).toBeLessThanOrEqual(0.0675 + 1e-6);
      }
    }
  });
});
