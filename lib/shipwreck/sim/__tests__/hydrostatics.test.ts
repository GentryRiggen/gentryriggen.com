import { buildHull, hullSlice } from "../geometry";
import { hydrostatics } from "../hydrostatics";

/**
 * A box hull 100 m long, 20 m wide, 10 m deep, origin at the keel midships,
 * checked against hand-clipped rectangles.
 */
const L = 100;
const B = 20;
const D = 10;
const stations = Array.from({ length: 41 }, (_, i) => ({
  x: -L / 2 + (L * i) / 40,
  offsets: [
    [0, B / 2],
    [D, B / 2],
  ] as const,
}));
const hull = buildHull({ stations });
const box = hullSlice(hull, -L / 2, L / 2);

type P = [number, number];

/** Clip a polygon to f(p) < 0 for a linear f; area, centroid, cut length. */
function clip(poly: P[], f: (p: P) => number) {
  const out: P[] = [];
  const cut: P[] = [];
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const fa = f(a);
    const fb = f(b);
    if (fa < 0) out.push(a);
    if (fa < 0 !== fb < 0) {
      const t = fa / (fa - fb);
      const p: P = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      out.push(p);
      cut.push(p);
    }
  }
  let a2 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < out.length; i += 1) {
    const [x0, y0] = out[i];
    const [x1, y1] = out[(i + 1) % out.length];
    const cr = x0 * y1 - x1 * y0;
    a2 += cr;
    cx += (x0 + x1) * cr;
    cy += (y0 + y1) * cr;
  }
  const area = a2 / 2;
  const chord =
    cut.length === 2
      ? Math.hypot(cut[1][0] - cut[0][0], cut[1][1] - cut[0][1])
      : 0;
  return { area, cx: cx / (6 * area), cy: cy / (6 * area), chord };
}

/** Pitch only: the (x, z) profile clipped, times the breadth. */
function pitched(heave: number, pitch: number) {
  const r = clip(
    [
      [-L / 2, 0],
      [L / 2, 0],
      [L / 2, D],
      [-L / 2, D],
    ],
    ([x, z]) => heave - Math.sin(pitch) * x + Math.cos(pitch) * z
  );
  return {
    volume: r.area * B,
    cb: { x: r.cx, y: 0, z: r.cy },
    waterplaneArea: r.chord * B,
  };
}

/** Roll only: the (y, z) section clipped, times the length. */
function heeled(heave: number, roll: number) {
  const r = clip(
    [
      [-B / 2, 0],
      [B / 2, 0],
      [B / 2, D],
      [-B / 2, D],
    ],
    ([y, z]) => heave + Math.sin(roll) * y + Math.cos(roll) * z
  );
  return {
    volume: r.area * L,
    cb: { x: 0, y: r.cx, z: r.cy },
    waterplaneArea: r.chord * L,
  };
}

const DEG = Math.PI / 180;

function expectClose(
  got: ReturnType<typeof hydrostatics>,
  want: ReturnType<typeof pitched>,
  awpTol = 0.01
) {
  expect(Math.abs(got.volume - want.volume) / want.volume).toBeLessThan(0.005);
  expect(Math.abs(got.cb.x - want.cb.x)).toBeLessThan(0.15);
  expect(Math.abs(got.cb.y - want.cb.y)).toBeLessThan(0.02);
  expect(Math.abs(got.cb.z - want.cb.z)).toBeLessThan(0.02);
  expect(
    Math.abs(got.waterplaneArea - want.waterplaneArea) / want.waterplaneArea
  ).toBeLessThan(awpTol);
}

describe("hydrostatics of a box hull", () => {
  it("level", () => {
    const got = hydrostatics(box, { heave: -4, pitch: 0, roll: 0 });
    expect(got.volume).toBeCloseTo(L * B * 4, 0);
    expect(got.cb.z).toBeCloseTo(2, 3);
    expect(got.cb.x).toBeCloseTo(0, 3);
    expect(got.waterplaneArea).toBeCloseTo(L * B, 0);
  });

  it("trimmed 2° by the bow", () => {
    expectClose(
      hydrostatics(box, { heave: -4, pitch: 2 * DEG, roll: 0 }),
      pitched(-4, 2 * DEG)
    );
  });

  it("heeled 10°", () => {
    expectClose(
      hydrostatics(box, { heave: -4, pitch: 0, roll: 10 * DEG }),
      heeled(-4, 10 * DEG)
    );
  });

  it("pitched 60°", () => {
    expectClose(
      hydrostatics(box, { heave: 0, pitch: 60 * DEG, roll: 0 }),
      pitched(0, 60 * DEG),
      0.02
    );
  });

  it("pitched 90° (standing on its bow)", () => {
    const got = hydrostatics(box, { heave: 20, pitch: 90 * DEG, roll: 0 });
    expect(Math.abs(got.volume - 30 * B * D) / (30 * B * D)).toBeLessThan(
      0.005
    );
    expect(got.cb.x).toBeCloseTo(35, 1);
    expect(got.cb.z).toBeCloseTo(D / 2, 2);
    expect(Math.abs(got.waterplaneArea - B * D) / (B * D)).toBeLessThan(0.02);
  });

  it("is clear of the water above it and whole below it", () => {
    expect(hydrostatics(box, { heave: 1, pitch: 0, roll: 0 }).volume).toBe(0);
    expect(
      hydrostatics(box, { heave: -11, pitch: 0, roll: 0 }).volume
    ).toBeCloseTo(L * B * D, 0);
  });
});
