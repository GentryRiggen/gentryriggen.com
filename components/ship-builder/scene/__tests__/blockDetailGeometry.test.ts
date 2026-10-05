import type { BufferGeometry } from "three";
import { NO_JOINED_SIDES } from "@/lib/ship-builder/model/blockSides";
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
    expect(triangleCount(g.frames!)).toBe(panes * 4 * 12);
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
    const { min, max } = bounds(g.frames!);
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
    const { min, max } = bounds(g.frames!);
    expect(max.z).toBeLessThanOrEqual(size.z * 0.5 + 1e-6);
    expect(min.z).toBeGreaterThanOrEqual(-size.z * 0.5 - 1e-6);
    expect(max.y).toBeLessThanOrEqual(0.8);
  });
});

describe("windows on joined sides", () => {
  it("builds none on a joined face", () => {
    const open = buildWindowGeometries({ x: 1, z: 1 }, CABIN_WINDOW_ROWS);
    const joined = buildWindowGeometries(
      { x: 1, z: 1 },
      CABIN_WINDOW_ROWS,
      () => false,
      undefined,
      { ...NO_JOINED_SIDES, bow: true }
    );
    expect(triangleCount(joined.frames!)).toBe(
      (triangleCount(open.frames!) * 3) / 4
    );
    // The bow is world +x: nothing stands on that face any more.
    const { max } = bounds(joined.frames!);
    expect(max.x).toBeLessThan(0.45);
  });

  it("builds nothing when every wall is joined", () => {
    const g = buildWindowGeometries(
      { x: 1, z: 1 },
      CABIN_WINDOW_ROWS,
      () => true,
      undefined,
      { bow: true, stern: true, starboard: true, port: true, top: false }
    );
    expect(allOf(g)).toHaveLength(0);
    expect(g.frames).toBeNull();
  });

  it("drops a bridge's wing on a joined side", () => {
    const wide = { x: 2, z: 5 };
    const both = buildWindowGeometries(
      wide,
      BRIDGE_WINDOW_ROWS,
      undefined,
      0.8
    );
    const one = buildWindowGeometries(
      wide,
      BRIDGE_WINDOW_ROWS,
      undefined,
      0.8,
      { ...NO_JOINED_SIDES, port: true }
    );
    expect(bounds(both.frames!).min.z).toBeLessThan(bounds(one.frames!).min.z);
  });
});

describe("trimBand on joined sides", () => {
  const body = { x: 1, z: 1 };

  it("leaves a joined face bare and runs to the cell edge at the join", () => {
    const { min, max } = bounds(
      trimBand(body, 0.07, { ...NO_JOINED_SIDES, bow: true })
    );
    // No band on the bow face: the stern face and rounded corners only.
    expect(max.x).toBeCloseTo(0.5, 4);
    expect(min.x).toBeCloseTo(-0.48 - 0.0075, 4);
  });

  it("is empty when every wall is joined", () => {
    const geometry = trimBand(body, 0.07, {
      bow: true,
      stern: true,
      starboard: true,
      port: true,
      top: false,
    });
    expect(geometry.getAttribute("position").count).toBe(0);
  });

  it("has no rounded corner where a neighbour continues the wall", () => {
    // With the bow joined, the port face runs straight to the cell edge.
    const position = trimBand(body, 0.07, {
      ...NO_JOINED_SIDES,
      bow: true,
    }).getAttribute("position");
    let reaches = false;
    for (let i = 0; i < position.count; i++) {
      if (
        Math.abs(position.getZ(i) + 0.4875) < 1e-4 &&
        Math.abs(position.getX(i) - 0.5) < 1e-4
      ) {
        reaches = true;
      }
    }
    expect(reaches).toBe(true);
  });

  it("faces every triangle outward", () => {
    const geometry = trimBand(body, 0.07, NO_JOINED_SIDES);
    const position = geometry.getAttribute("position");
    for (let t = 0; t < position.count; t += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => ({
        x: position.getX(t + k),
        y: position.getY(t + k),
        z: position.getZ(t + k),
      }));
      const ux = b.x - a.x;
      const uy = b.y - a.y;
      const uz = b.z - a.z;
      const vx = c.x - a.x;
      const vy = c.y - a.y;
      const vz = c.z - a.z;
      const nx = uy * vz - uz * vy;
      const nz = ux * vy - uy * vx;
      const centreX = (a.x + b.x + c.x) / 3;
      const centreZ = (a.z + b.z + c.z) / 3;
      expect(nx * centreX + nz * centreZ).toBeGreaterThan(0);
    }
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
