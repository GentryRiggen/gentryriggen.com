import type { BufferGeometry } from "three";
import {
  createBeamGeometry,
  createHaloGeometry,
  createPoolGeometry,
  softFalloff,
} from "../glowGeometry";

// These tests import the real `three` (no mock), which proves Jest can load it.

function boundsOf(geometry: BufferGeometry) {
  geometry.computeBoundingBox();
  if (!geometry.boundingBox) throw new Error("no bounding box");
  return geometry.boundingBox;
}

describe("glow geometry", () => {
  it("builds a flat pool that fades from a bright centre to a black rim", () => {
    const pool = createPoolGeometry(2);
    const box = boundsOf(pool);
    const positions = pool.getAttribute("position");
    const colors = pool.getAttribute("color");

    expect(positions.count).toBe(203);
    expect(box.min.y).toBeCloseTo(0);
    expect(box.max.y).toBeCloseTo(0);
    expect(box.max.x).toBeCloseTo(2);
    expect(box.min.z).toBeCloseTo(-2);
    for (let i = 0; i < positions.count; i++) {
      const radius = Math.hypot(positions.getX(i), positions.getZ(i));
      if (radius > 1.999) expect(colors.getX(i)).toBeCloseTo(0);
      if (radius < 0.001) expect(colors.getX(i)).toBeGreaterThan(0.99);
    }
    pool.dispose();
  });

  it("builds an open beam along +X from the origin to its length", () => {
    const beam = createBeamGeometry(3, 0.1, 0.8);
    const box = boundsOf(beam);

    expect(beam.getAttribute("position").count).toBe(105);
    expect(box.min.x).toBeCloseTo(0);
    expect(box.max.x).toBeCloseTo(3);
    // 14 radial segments: the widest vertex sits just inside the end radius.
    expect(box.max.y).toBeGreaterThan(0.77);
    expect(box.max.y).toBeLessThanOrEqual(0.8);
    expect(box.max.z).toBeGreaterThan(0.77);
    beam.dispose();
  });

  it("builds a halo sphere of the requested radius", () => {
    const halo = createHaloGeometry(0.5);
    const box = boundsOf(halo);

    expect(halo.getAttribute("position").count).toBe(117);
    expect(box.max.x).toBeCloseTo(0.5);
    expect(box.min.y).toBeCloseTo(-0.5);
    halo.dispose();
  });

  it("falls off from 1 at the bright end to 0 at the faded end", () => {
    expect(softFalloff(0)).toBeCloseTo(1);
    expect(softFalloff(1)).toBeCloseTo(0);
  });
});
