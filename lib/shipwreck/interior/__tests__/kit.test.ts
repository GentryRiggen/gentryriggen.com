import type { V2 } from "../../walk/types";
import {
  CHAMFER_M,
  DOOR_MIN_M,
  cabin,
  chamferReflex,
  corridor,
  doorway,
  flight,
  pieceBlocker,
  signedArea,
} from "../kit";

function hasEdge(poly: readonly V2[], p: V2, q: V2): boolean {
  const near = (a: V2, b: V2) =>
    Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if ((near(a, p) && near(b, q)) || (near(a, q) && near(b, p))) return true;
  }
  return false;
}

function distToLine(p: V2, a: V2, b: V2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / Math.hypot(dx, dy);
}

describe("corridor", () => {
  it.each([
    [[0, 0] as V2, [10, 0] as V2, 1.4],
    [[31, -5.3] as V2, [14, -5.3] as V2, 1.4],
    [[0, 0] as V2, [3, 4] as V2, 2],
  ])("is counter-clockwise with the given width (%j → %j, %d m)", (a, b, w) => {
    const c = corridor("c", a, b, w);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    expect(c.outline).toHaveLength(4);
    expect(signedArea(c.outline)).toBeCloseTo(len * w, 9);
    // Every corner is half the width off the centre line.
    for (const p of c.outline)
      expect(distToLine(p, a, b)).toBeCloseTo(w / 2, 9);
    expect(c.axis).toEqual([a, b]);
  });
});

describe("cabin and flight", () => {
  it("makes a counter-clockwise box", () => {
    const c = cabin("c", [26, -11], [30.8, -6]);
    expect(signedArea(c.outline)).toBeCloseTo(4.8 * 5, 9);
  });

  it("makes a ramp falling from its top to its bottom", () => {
    const f = flight("f", [35, 0], [39, 0], 3, 1.52);
    expect(signedArea(f.outline)).toBeCloseTo(12, 9);
    expect(f.ramp).toEqual({ from: [35, 0], to: [39, 0], dropM: 1.52 });
  });
});

describe("doorway", () => {
  const a = cabin("a", [0, 0], [4, 4]);
  const b = cabin("b", [4, 0], [8, 4]);

  it("cuts matching segments into both outlines and returns the seam", () => {
    const d = doorway(a, b, [4, 2], 1.2);
    expect(d.seam.a).toBe("a");
    expect(d.seam.b).toBe("b");
    const [p, q] = d.seam.at;
    expect(Math.hypot(q[0] - p[0], q[1] - p[1])).toBeCloseTo(1.2, 9);
    expect(hasEdge(d.a.outline, p, q)).toBe(true);
    expect(hasEdge(d.b.outline, p, q)).toBe(true);
    expect(d.a.outline).toHaveLength(6);
    expect(d.b.outline).toHaveLength(6);
    // The outlines keep their area and stay counter-clockwise.
    expect(signedArea(d.a.outline)).toBeCloseTo(16, 9);
    expect(signedArea(d.b.outline)).toBeCloseTo(16, 9);
    // The inputs are untouched.
    expect(a.outline).toHaveLength(4);
  });

  it("widens a doorway to at least 1.1 m", () => {
    expect(DOOR_MIN_M).toBe(1.1);
    const d = doorway(a, b, [4, 2], 0.75);
    const [p, q] = d.seam.at;
    expect(Math.hypot(q[0] - p[0], q[1] - p[1])).toBeCloseTo(1.1, 9);
  });

  it("opens a whole edge without doubling its corners", () => {
    const f = flight("f", [4, 1], [8, 1], 2, 1);
    const d = doorway(a, f, [4, 1], 2);
    expect(d.b.outline).toHaveLength(4);
    // One new corner in a (the other end is its own corner).
    expect(d.a.outline).toHaveLength(5);
    expect(hasEdge(d.b.outline, d.seam.at[0], d.seam.at[1])).toBe(true);
  });

  it("refuses rooms that share no wall, or an opening wider than the wall", () => {
    const far = cabin("far", [5, 0], [9, 4]);
    expect(() => doorway(a, far, [4.5, 2], 1.2)).toThrow();
    expect(() => doorway(a, b, [4, 3.6], 1.2)).toThrow();
  });
});

describe("chamferReflex", () => {
  // An L: one reflex corner at (2, 2).
  const L: V2[] = [
    [0, 0],
    [4, 0],
    [4, 2],
    [2, 2],
    [2, 4],
    [0, 4],
  ];

  it("cuts every reflex corner by 0.15 m and leaves convex ones", () => {
    expect(CHAMFER_M).toBe(0.15);
    const c = chamferReflex(L);
    expect(c).toHaveLength(7);
    for (const p of [L[0], L[1], L[2], L[4], L[5]]) expect(c).toContainEqual(p);
    expect(c).not.toContainEqual([2, 2]);
    expect(c).toContainEqual([2.15, 2]);
    expect(c).toContainEqual([2, 2.15]);
    // The corner poking into the room is cut off: the room grows a little.
    expect(signedArea(c)).toBeCloseTo(12 + (0.15 * 0.15) / 2, 9);
  });

  it("leaves a convex outline alone", () => {
    const box = cabin("b", [0, 0], [3, 2]).outline;
    expect(chamferReflex(box)).toEqual(box);
  });

  it("keeps a reflex corner it is told to keep (a seam's end)", () => {
    expect(chamferReflex(L, [[2, 2]])).toEqual(L);
  });

  it("refuses a cut longer than the edge beside it", () => {
    const tight: V2[] = [
      [0, 0],
      [4, 0],
      [4, 2],
      [2.1, 2],
      [2, 2],
      [2, 4],
      [0, 4],
    ];
    expect(() => chamferReflex(tight)).toThrow();
  });
});

describe("pieceBlocker", () => {
  it("turns a blocking piece into a box, swapped for a quarter turn", () => {
    const along = pieceBlocker({
      room: "r",
      piece: "bed",
      at: [0, 0],
      yaw: 0,
      blocks: true,
    });
    const across = pieceBlocker({
      room: "r",
      piece: "bed",
      at: [0, 0],
      yaw: Math.PI / 2,
      blocks: true,
    });
    expect(along?.kind).toBe("box");
    expect(across?.kind).toBe("box");
    if (along?.kind !== "box" || across?.kind !== "box") return;
    expect(along.area).toBe("r");
    expect(along.max[0] - along.min[0]).toBeCloseTo(
      across.max[1] - across.min[1],
      9
    );
    expect(along.max[1] - along.min[1]).toBeCloseTo(
      across.max[0] - across.min[0],
      9
    );
  });

  it("returns nothing for a piece that does not block", () => {
    expect(
      pieceBlocker({ room: "r", piece: "sconce", at: [0, 0], yaw: 0 })
    ).toBeNull();
  });
});
