import { TITANIC_BOATS, titanic } from "@/lib/shipwreck/ships/titanic";
import { HULL_FRACTIONS, pchipAt, pchipSlopes } from "../hullSurface";
import { titanicRecipe, type V3 } from "../titanicRecipe";

const r = titanicRecipe(titanic);
const { hull, layout: L } = r;
const edge = (x: number) => hull.topHalfBreadth(x);

/** Inside the ship's plan outline (with a little tolerance), above the keel. */
function withinHull(p: V3, slack = 0.15): boolean {
  const [x, y, z] = p;
  if (x < hull.xMin - slack || x > hull.xMax + slack) return false;
  if (Math.abs(y) > edge(x) + slack + 0.6) return false;
  return z >= -slack && z <= 75;
}

describe("hull surface", () => {
  it("never overshoots between monotone points", () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = [0, 0, 1, 1, 1];
    const ms = pchipSlopes(xs, ys);
    for (let x = 0; x <= 4; x += 0.05) {
      const v = pchipAt(xs, ys, ms, x);
      expect(v).toBeGreaterThanOrEqual(-1e-9);
      expect(v).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it("passes through the spec's offsets forward of the counter", () => {
    for (const st of titanic.stations) {
      if (st.x < -60 || st.x >= hull.xMax) continue;
      const s = hull.section(st.x);
      st.offsets.forEach(([, hb], j) => {
        expect(s.hb[j]).toBeCloseTo(hb, 2);
      });
      expect(HULL_FRACTIONS.length).toBe(st.offsets.length);
    }
  });

  it("only widens the counter above the water, never narrows it", () => {
    for (const st of titanic.stations) {
      const s = hull.section(st.x);
      st.offsets.forEach(([z, hb], j) => {
        if (st.x <= hull.xMin || st.x >= hull.xMax) return;
        expect(s.hb[j]).toBeGreaterThanOrEqual(hb - 5e-3);
        if (z < 11) expect(s.hb[j]).toBeCloseTo(hb, 2);
      });
    }
  });

  it("is never wider than the beam", () => {
    for (let x = hull.xMin; x <= hull.xMax; x += 0.7)
      for (let z = 0; z <= 23; z += 0.5)
        expect(hull.halfBreadth(x, z)).toBeLessThanOrEqual(
          titanic.beam / 2 + 5e-3
        );
  });
});

describe("Titanic recipe", () => {
  it("follows the spec's superstructure boxes", () => {
    const boxes = titanic.superstructure;
    expect(L.poopTo).toBeCloseTo(boxes[0].toX, 0);
    expect(L.bridgeDeckFrom).toBeCloseTo(boxes[1].fromX, 0);
    expect(L.boatDeckFrom).toBeCloseTo(boxes[2].fromX, 0);
    expect(L.boatDeckTo).toBeCloseTo(boxes[2].toX, 0);
    expect(L.bridgeDeckTo).toBeCloseTo(boxes[3].toX, 0);
    expect(L.forecastleFrom).toBeCloseTo(boxes[4].fromX, 0);
    expect(L.sternX).toBe(titanic.stations[0].x);
    expect(L.stemX).toBe(titanic.stations[titanic.stations.length - 1].x);
  });

  it("has four funnels, the last a dummy, on the boat deck", () => {
    expect(r.funnels).toHaveLength(4);
    expect(r.funnels.map((f) => f.dummy)).toEqual([false, false, false, true]);
    r.funnels.forEach((f, i) => {
      expect(f.x).toBe(titanic.funnels[i].x);
      expect(f.topZ).toBe(titanic.funnels[i].topZ);
      expect(f.x).toBeGreaterThan(L.boatDeckFrom);
      expect(f.x).toBeLessThan(L.boatDeckTo);
      expect(f.rake).toBeGreaterThan(0.025);
      expect(f.rake).toBeLessThan(0.045);
      expect(f.semiA).toBeGreaterThan(f.semiB);
      expect(f.blackTop).toBeLessThan(f.topZ - f.baseZ);
    });
    // Evenly spaced, within a metre.
    const gaps = r.funnels.slice(1).map((f, i) => r.funnels[i].x - f.x);
    for (const g of gaps) expect(Math.abs(g - gaps[0])).toBeLessThan(1);
  });

  it("has 20 boats in the sim's order: 14 lifeboats, 2 cutters, 4 collapsibles", () => {
    expect(r.boats.map((b) => b.label)).toEqual([...TITANIC_BOATS]);
    const count = (k: string) => r.boats.filter((b) => b.kind === k).length;
    expect(count("lifeboat")).toBe(14);
    expect(count("cutter")).toBe(2);
    expect(count("collapsible")).toBe(4);
    r.boats.forEach((b, i) => {
      expect(b.index).toBe(i);
      const n = Number(b.label);
      if (Number.isFinite(n))
        expect(b.side).toBe(n % 2 === 1 ? "starboard" : "port");
      expect(Math.sign(b.y)).toBe(b.side === "port" ? 1 : -1);
      // On the boat deck (or a house roof on it), inside the deck edge.
      expect(b.x).toBeGreaterThan(L.boatDeckFrom);
      expect(b.x).toBeLessThan(L.boatDeckTo);
      expect(Math.abs(b.y) + b.beam / 2).toBeLessThan(edge(b.x));
      expect(b.z).toBeGreaterThanOrEqual(b.deckZ);
      expect(b.z).toBeLessThan(b.deckZ + 3.5);
    });
    expect(r.davits).toHaveLength(32);
    // No two boats overlap.
    for (const a of r.boats)
      for (const b of r.boats) {
        if (a === b || Math.abs(a.z - b.z) > 1) continue;
        const apart =
          Math.abs(a.x - b.x) >= (a.length + b.length) / 2 ||
          Math.abs(a.y - b.y) >= (a.beam + b.beam) / 2;
        expect(apart).toBe(true);
      }
  });

  it("has thousands of lit portholes and windows, all on the ship", () => {
    const portholes = r.lights.filter((l) => l.kind === "porthole");
    const windows = r.lights.filter((l) => l.kind === "window");
    expect(portholes.length).toBeGreaterThan(1400);
    expect(windows.length).toBeGreaterThan(400);
    expect(r.lights.length).toBeGreaterThan(2000);
    for (const l of r.lights) {
      expect(withinHull(l.p)).toBe(true);
      expect(l.deck).toBeGreaterThanOrEqual(0);
      expect(l.deck).toBeLessThan(titanic.decks.length);
      expect(l.seed).toBeGreaterThanOrEqual(0);
      expect(l.seed).toBeLessThan(1);
      expect(Math.hypot(...l.n)).toBeCloseTo(1, 6);
    }
  });

  it("puts the hull's portholes on the plating, below the sheer", () => {
    const hullDecks = ["D", "E", "F", "G"].map((d) => r.deckIndex(d));
    const onHull = r.lights.filter((l) => hullDecks.includes(l.deck));
    expect(onHull.length).toBeGreaterThan(1000);
    for (const l of onHull) {
      const [x, y, z] = l.p;
      expect(z).toBeLessThan(titanic.sheerZ(x));
      expect(Math.abs(Math.abs(y) - hull.halfBreadth(x, z))).toBeLessThan(0.1);
      // Facing outboard.
      expect(Math.sign(l.n[1])).toBe(Math.sign(y));
    }
  });

  it("keeps every fitting, house and wire on the ship", () => {
    const points: V3[] = [
      ...r.vents.map((v) => v.p),
      ...r.benches.map((v) => v.p),
      ...r.bollards.map((v) => v.p),
      ...r.capstans.map((v) => v.p),
      ...r.cranes.map((v) => v.p),
      ...r.rails.flatMap((run) => run.points),
      ...r.wires.flatMap((w) => [w.a, w.b]),
      ...r.funnelGuys.flat().flatMap((w) => [w.a, w.b]),
      ...r.anchors.map((a) => a.p),
    ];
    for (const p of points) expect(withinHull(p)).toBe(true);
    for (const h of r.houses) {
      for (const x of [h.x0, h.x1]) {
        expect(x).toBeGreaterThanOrEqual(L.boatDeckFrom - 0.01);
        expect(x).toBeLessThanOrEqual(L.boatDeckTo + 0.7);
        // The bridge's wing cabs overhang the side a little.
        const overhang = h.id.startsWith("bridge-cab") ? 0.9 : 0.5;
        expect(Math.max(Math.abs(h.y0), Math.abs(h.y1))).toBeLessThan(
          edge(x) + overhang
        );
      }
    }
  });

  it("stands the masts in the wells and the propellers clear of the hull", () => {
    const [fore, main] = r.masts;
    expect(fore.x).toBeGreaterThan(L.bridgeDeckTo);
    expect(fore.x).toBeLessThan(L.forecastleFrom);
    expect(main.x).toBeGreaterThan(L.poopTo);
    expect(main.x).toBeLessThan(L.bridgeDeckFrom);
    expect(r.propellers.map((p) => p.blades).sort()).toEqual([3, 3, 4]);
    for (const p of r.propellers) {
      const [x, y, z] = p.hub;
      // The blade tips stay above the keel and below the waterline.
      expect(z - p.radius).toBeGreaterThan(0);
      expect(z + p.radius).toBeLessThan(titanic.draught);
      // Wing propellers: the inner tips clear the hull.
      if (p.blades === 3)
        expect(Math.abs(y) - p.radius).toBeGreaterThan(hull.halfBreadth(x, z));
    }
  });
});
