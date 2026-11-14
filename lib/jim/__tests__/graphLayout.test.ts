import { bounds, layoutGraph, MAX_ZOOM, zoomAt } from "../graphLayout";

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe("layoutGraph", () => {
  it("pulls linked notes together and pushes the rest apart", () => {
    const ids = ["a", "b", "c", "d", "e", "f"];
    const pos = layoutGraph(ids, [
      { source: "a", target: "b" },
      { source: "c", target: "d" },
    ]);
    expect(pos.size).toBe(6);
    expect(dist(pos.get("a")!, pos.get("b")!)).toBeLessThan(
      dist(pos.get("a")!, pos.get("e")!)
    );
    for (const p of pos.values()) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    }
  });

  it("is deterministic and ignores links to unknown notes", () => {
    const ids = ["a", "b", "c"];
    const links = [
      { source: "a", target: "b" },
      { source: "a", target: "zzz" },
    ];
    expect([...layoutGraph(ids, links)]).toEqual([...layoutGraph(ids, links)]);
  });

  it("lays out the largest graph the server sends in good time", () => {
    const ids = Array.from({ length: 1500 }, (_, i) => `n${i}`);
    const links = ids.slice(1).map((id, i) => ({
      source: id,
      target: ids[Math.floor(i / 3)],
    }));
    const start = Date.now();
    const pos = layoutGraph(ids, links, { iterations: 1000 });
    expect(Date.now() - start).toBeLessThan(5000);
    expect(pos.size).toBe(1500);
  });
});

describe("bounds and zoom", () => {
  it("pads the box around the points", () => {
    expect(
      bounds(
        [
          { x: 0, y: 0 },
          { x: 10, y: 20 },
        ],
        5
      )
    ).toEqual({ x: -5, y: -5, width: 20, height: 30 });
  });

  it("zooms around a point and stops at the limits", () => {
    const v = zoomAt({ k: 1, tx: 0, ty: 0 }, 2, 50, 50);
    expect(v).toEqual({ k: 2, tx: -50, ty: -50 });
    // The point under the pinch stays put: 50 → 50*2 - 50 = 50.
    expect(50 * v.k + v.tx).toBe(50);
    expect(zoomAt({ k: 5, tx: 0, ty: 0 }, 10, 0, 0).k).toBe(MAX_ZOOM);
  });
});
