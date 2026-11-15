import {
  angularDistance,
  dirToUv,
  moveOnSphere,
  moveOnSphereInto,
  uvToDir,
} from "../sphere";

describe("sphere", () => {
  it("maps uv to the three.js SphereGeometry direction", () => {
    const d = uvToDir(0.25, 0.5);
    expect(d.x).toBeCloseTo(0);
    expect(d.y).toBeCloseTo(0);
    expect(d.z).toBeCloseTo(1);
  });

  it("puts v = 1 at the north pole", () => {
    for (const u of [0, 0.3, 0.9]) {
      const d = uvToDir(u, 1);
      expect(d.x).toBeCloseTo(0);
      expect(d.y).toBeCloseTo(1);
      expect(d.z).toBeCloseTo(0);
    }
  });

  it("measures distance across the seam", () => {
    expect(
      angularDistance(uvToDir(0.999, 0.5), uvToDir(0.001, 0.5))
    ).toBeLessThan(0.02);
  });
});

describe("dirToUv", () => {
  it("round-trips with uvToDir", () => {
    for (const [u, v] of [
      [0.5, 0.5],
      [0.1, 0.8],
      [0.93, 0.2],
      [0.0, 0.5],
    ]) {
      const back = dirToUv(uvToDir(u, v));
      expect(back.v).toBeCloseTo(v, 6);
      expect(
        Math.min(Math.abs(back.u - u), 1 - Math.abs(back.u - u))
      ).toBeCloseTo(0, 6);
    }
  });

  it("moveOnSphereInto matches moveOnSphere, even in place", () => {
    const p = { x: 0.6, y: 0, z: 0.8 };
    const t = { x: 0, y: 1, z: 0 };
    const want = moveOnSphere(p, t, 0.3);
    const outP = { x: 0, y: 0, z: 0 };
    const outT = { x: 0, y: 0, z: 0 };
    moveOnSphereInto(p, t, 0.3, outP, outT);
    expect(outP).toEqual(want.p);
    expect(outT).toEqual(want.t);
    const a = { ...p };
    const b = { ...t };
    moveOnSphereInto(a, b, 0.3, a, b);
    expect(a).toEqual(want.p);
    expect(b).toEqual(want.t);
  });
});
