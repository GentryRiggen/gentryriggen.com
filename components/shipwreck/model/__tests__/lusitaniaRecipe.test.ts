import { LUSITANIA_BOATS, lusitania } from "@/lib/shipwreck/ships/lusitania";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import { TEAR_AMPLITUDE, sideOf } from "../breakCut";
import { buildShipPart, type ShipPartData } from "../buildShip";
import { PEACETIME_PAINT, lusitaniaRecipe } from "../lusitaniaRecipe";
import { recipeFor } from "../shipModel";
import { swungOutY, type V3 } from "../titanicRecipe";

const r = lusitaniaRecipe(lusitania);
const { hull, layout: L } = r;
const edge = (x: number) => hull.topHalfBreadth(x);

/** Inside the ship's plan outline (a little slack), keel to masthead. */
function withinHull(p: V3, slack = 0.15): boolean {
  const [x, y, z] = p;
  if (x < hull.xMin - slack || x > hull.xMax + slack) return false;
  if (Math.abs(y) > edge(x) + slack + 0.6) return false;
  return z >= -slack && z <= 75;
}

describe("Lusitania recipe", () => {
  it("is what the model builds for her, and the Titanic keeps hers", () => {
    expect(recipeFor(lusitania).spec).toBe(lusitania);
    expect(recipeFor(lusitania).paint?.name).toBe("LUSITANIA");
    expect(recipeFor(titanic).paint).toBeUndefined();
  });

  it("is painted as on 7 May 1915 unless the switch says peacetime", () => {
    expect(PEACETIME_PAINT).toBe(false);
    const p = r.paint!;
    // Funnels painted out dark, tops and bands painted over (each channel
    // within 5%), the gilt band round the superstructure.
    expect(p.funnel).toBeLessThan(0x404040);
    for (const shift of [0, 8, 16]) {
      const a = (p.funnel >> shift) & 0xff;
      const b = (p.funnelTop >> shift) & 0xff;
      expect(Math.abs(a - b)).toBeLessThanOrEqual(0.05 * a);
    }
    expect(p.sheerLine).not.toBeNull();
    // The gilt band stops at the house front (not across the foredeck's
    // black plating under her name).
    const front = L.boatDeckTo;
    expect(r.sheerLineZ!(front - 1)).toBe(lusitania.sheerZ(front - 1));
    expect(r.sheerLineZ!(front + 1)).toBeGreaterThan(100);
  });

  it("spans her hull, stem to counter", () => {
    expect(L.sternX).toBe(lusitania.stations[0].x);
    expect(L.stemX).toBe(lusitania.stations[lusitania.stations.length - 1].x);
    // Every tier's ends are the data's boxes: the long house (its front
    // the bridge's) and the 2nd class house aft.
    const [aftBox, foreBox, longBox] = lusitania.superstructure;
    expect(L.boatDeckFrom).toBe(longBox.fromX);
    expect(L.boatDeckTo).toBe(longBox.toX);
    expect(L.poopTo).toBe(aftBox.fromX);
    const block = (id: string) => r.blocks!.find((b) => b.id === id)!;
    expect(block("foredeck").x0).toBe(foreBox.fromX);
    expect(block("boat-deck").x1).toBe(longBox.toX);
    expect(block("aft-c").x0).toBe(aftBox.fromX);
    expect(block("aft-c").x1).toBeLessThan(longBox.fromX);
    expect(L.boatDeckFrom).toBeLessThan(lusitania.funnels[3].x);
    expect(L.boatDeckTo).toBeGreaterThan(lusitania.funnels[0].x);
  });

  it("has four working funnels, raked aft, on the boat deck", () => {
    expect(r.funnels).toHaveLength(4);
    r.funnels.forEach((f, i) => {
      expect(f.dummy).toBe(false);
      expect(f.x).toBe(lusitania.funnels[i].x);
      expect(f.baseZ).toBe(lusitania.funnels[i].baseZ);
      expect(f.topZ).toBe(lusitania.funnels[i].topZ);
      expect(f.x).toBeGreaterThan(L.boatDeckFrom);
      expect(f.x).toBeLessThan(L.boatDeckTo);
      // Visibly raked (5–9°), unlike the Titanic's 2°.
      expect(f.rake).toBeGreaterThan(5 * (Math.PI / 180));
      expect(f.rake).toBeLessThan(9 * (Math.PI / 180));
      expect(f.blackTop).toBeLessThan(f.topZ - f.baseZ);
      expect(f.bands.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("has her 48 boats in the data's order, 22 under davits", () => {
    expect(r.boats).toHaveLength(LUSITANIA_BOATS.length);
    r.boats.forEach((b, i) => {
      const d = LUSITANIA_BOATS[i];
      expect(b.index).toBe(d.index);
      expect(b.label).toBe(d.label);
      expect(b.side).toBe(d.side);
      expect(b.x).toBe(d.x);
      expect(b.kind).toBe(d.kind === "wooden" ? "lifeboat" : "collapsible");
      expect(b.hasDavits).toBe(d.kind === "wooden");
      expect(Math.sign(b.y)).toBe(b.side === "port" ? 1 : -1);
      expect(Math.abs(b.y) + b.beam / 2).toBeLessThan(edge(b.x));
      expect(b.z).toBeGreaterThanOrEqual(b.deckZ);
      expect(b.z).toBeLessThan(b.deckZ + 3.5);
      expect(b.deckZ).toBeCloseTo(r.deckZ("Boat", b.x), 6);
    });
    expect(r.boats.filter((b) => b.kind === "lifeboat")).toHaveLength(22);
    expect(r.boats.filter((b) => b.kind === "collapsible")).toHaveLength(26);
    // Two davits a wooden boat, at its ends, feet at the deck edge, arms
    // swung out over the side (as they were from the day before).
    expect(r.davits).toHaveLength(44);
    for (const b of r.boats.filter((x) => x.hasDavits)) {
      const ds = r.davits.filter((d) => d.boat === b.index);
      expect(ds).toHaveLength(2);
      for (const d of ds) {
        expect(Math.abs(d.x - b.x)).toBeLessThan(b.length / 2);
        expect(d.footY).toBe(b.edgeY);
        expect(d.headY).toBe(swungOutY(b));
        expect(Math.abs(d.headY)).toBeGreaterThan(Math.abs(d.footY));
      }
    }
    // No two boats overlap: apart in plan, or stacked one on the other.
    for (const a of r.boats)
      for (const b of r.boats) {
        if (a === b) continue;
        const apart =
          Math.abs(a.x - b.x) >= (a.length + b.length) / 2 ||
          Math.abs(a.y - b.y) >= (a.beam + b.beam) / 2;
        const lower = a.z < b.z ? a : b;
        const upper = a.z < b.z ? b : a;
        const stacked = upper.z - lower.z >= lower.depth * 1.08;
        expect(apart || stacked).toBe(true);
      }
  });

  it("has four propellers and one rudder under the stern", () => {
    expect(r.propellers).toHaveLength(4);
    for (const p of r.propellers) {
      const [x, y, z] = p.hub;
      expect(p.blades).toBe(4);
      expect(z - p.radius).toBeGreaterThan(0);
      expect(z + p.radius).toBeLessThan(lusitania.draught);
      // The inner tips clear the hull.
      expect(Math.abs(y) - p.radius).toBeGreaterThan(hull.halfBreadth(x, z));
      expect(x).toBeGreaterThan(L.sternX);
    }
    // Two a side, mirrored.
    const ys = r.propellers.map((p) => p.hub[1]).sort((a, b) => a - b);
    expect(ys[0]).toBe(-ys[3]);
    expect(ys[1]).toBe(-ys[2]);
    // One rudder, abaft the sternpost, under the counter, below the water.
    const xs = r.rudder.outline.map(([x]) => x);
    const zs = r.rudder.outline.map(([, z]) => z);
    expect(Math.max(...xs)).toBeLessThan(-lusitania.lbp / 2);
    expect(Math.min(...xs)).toBeGreaterThan(L.sternX);
    expect(Math.min(...zs)).toBeGreaterThan(0);
    expect(Math.max(...zs)).toBeLessThan(lusitania.draught);
    // A faired blade: a stock at its leading edge, tapering aft, its
    // after corners rounded.
    expect(r.rudder.taper!.lead).toBeGreaterThan(0.45);
    expect(r.rudder.taper!.trail).toBeLessThan(0.25);
    expect(r.rudder.stock!.x).toBeCloseTo(Math.max(...xs), 6);
    expect(r.rudder.outline.length).toBeGreaterThanOrEqual(12);
    // Each bossing's root lies inside the hull (faired, never an open end).
    expect(r.bossings).toHaveLength(4);
    for (const b of r.bossings)
      expect(hull.halfBreadth(b.from[0], b.from[2])).toBeGreaterThanOrEqual(
        Math.abs(b.from[1]) + b.r0
      );
    // The propellers turn clear forward of the rudder's leading edge.
    for (const p of r.propellers)
      expect(p.hub[0] - 1).toBeGreaterThan(Math.max(...xs));
  });

  it("puts portholes along every row the sim floods through", () => {
    const portholes = r.lights.filter((l) => l.kind === "porthole");
    for (const row of lusitania.portholes ?? []) {
      const s = row.side === "port" ? 1 : -1;
      const mid = (row.fromX + row.toX) / 2;
      const rowZ = (x: number) =>
        row.followsSheer
          ? row.z + lusitania.sheerZ(x) - lusitania.sheerZ(mid)
          : row.z;
      const onRow = portholes.filter(
        (l) =>
          Math.sign(l.p[1]) === s &&
          l.p[0] >= row.fromX - 0.1 &&
          l.p[0] <= row.toX + 0.1 &&
          Math.abs(l.p[2] - rowZ(l.p[0])) < 0.05
      );
      // No gap along the row longer than a few scuttles.
      const xs = onRow.map((l) => l.p[0]).sort((a, b) => a - b);
      expect(xs[0]).toBeLessThan(row.fromX + 4);
      expect(xs[xs.length - 1]).toBeGreaterThan(row.toX - 4);
      for (let i = 1; i < xs.length; i += 1)
        expect(xs[i] - xs[i - 1]).toBeLessThan(5);
    }
  });

  it("has her lights, all on the ship, on her own decks", () => {
    const portholes = r.lights.filter((l) => l.kind === "porthole");
    const windows = r.lights.filter((l) => l.kind === "window");
    expect(portholes.length).toBeGreaterThan(700);
    expect(windows.length).toBeGreaterThan(250);
    for (const l of r.lights) {
      expect(withinHull(l.p)).toBe(true);
      expect(l.deck).toBeGreaterThanOrEqual(0);
      expect(l.deck).toBeLessThan(lusitania.decks.length);
      expect(l.seed).toBeGreaterThanOrEqual(0);
      expect(l.seed).toBeLessThan(1);
      expect(Math.hypot(...l.n)).toBeCloseTo(1, 6);
    }
    const hullDecks = ["D", "E", "F"].map((d) => r.deckIndex(d));
    for (const l of r.lights.filter((x) => hullDecks.includes(x.deck))) {
      const [x, y, z] = l.p;
      expect(z).toBeLessThan(lusitania.sheerZ(x));
      expect(Math.abs(Math.abs(y) - hull.halfBreadth(x, z))).toBeLessThan(0.1);
      expect(Math.sign(l.n[1])).toBe(Math.sign(y));
    }
  });

  it("keeps every placement, tier, house and wire on the ship", () => {
    const points: V3[] = [
      ...r.vents.map((v) => v.p),
      ...(r.drums ?? []).map((v) => v.p),
      ...r.benches.map((v) => v.p),
      ...r.bollards.map((v) => v.p),
      ...r.capstans.map((v) => v.p),
      ...r.cranes.map((v) => v.p),
      ...(r.boxes ?? []).map((b) => b.c),
      ...r.rails.flatMap((run) => run.points),
      ...r.wires.flatMap((w) => [w.a, w.b]),
      ...r.funnelGuys.flat().flatMap((w) => [w.a, w.b]),
      ...r.anchors.map((a) => a.p),
      ...r.davits.map((d): V3 => [d.x, d.footY, d.z]),
      ...r.boats.map((b): V3 => [b.x, b.y, b.z]),
      ...(r.staffs ?? []).flatMap((s) => [s.foot, s.top]),
      ...r.masts.map((m): V3 => [m.x, 0, m.baseZ]),
    ];
    for (const p of points) expect([p, withinHull(p)]).toEqual([p, true]);
    for (const b of r.blocks ?? []) {
      expect(b.x0).toBeLessThan(b.x1);
      expect(b.x0).toBeGreaterThanOrEqual(hull.xMin);
      expect(b.x1).toBeLessThanOrEqual(hull.xMax);
      expect(() => r.deckZ(b.deck, 0)).not.toThrow();
    }
    for (const h of [
      ...r.houses,
      ...r.hatches.map((t) => ({ ...t, y0: -t.hw, y1: t.hw })),
    ])
      for (const x of [h.x0, h.x1])
        expect(Math.max(Math.abs(h.y0), Math.abs(h.y1))).toBeLessThan(edge(x));
    // Ventilators stand on the house roof clear of the funnel casings.
    for (const v of r.vents)
      for (const f of r.funnels)
        expect(Math.abs(v.p[0] - f.x) > 5.2 || Math.abs(v.p[1]) > 4.8).toBe(
          true
        );
    // A forest of them.
    expect(r.vents.length).toBeGreaterThanOrEqual(36);
  });

  it("stands the foremast on the foredeck and the mainmast abaft the boats", () => {
    const [fore, main] = r.masts;
    // 100 ft abaft the forward perpendicular, crow's nest 42 ft up (her
    // profile).
    expect(fore.x).toBeCloseTo(lusitania.lbp / 2 - 100 * 0.3048, 6);
    expect(fore.crowsNest!.z - fore.baseZ).toBeCloseTo(42 * 0.3048, 6);
    expect(fore.x).toBeGreaterThan(L.boatDeckTo);
    expect(main.x).toBeLessThan(L.boatDeckFrom);
    expect(fore.crowsNest).toBeDefined();
    // The wooden boats forward of it, the after collapsibles abaft it.
    for (const b of r.boats)
      expect(b.x > main.x).toBe(b.hasDavits || !/^[SP]\d$/.test(b.label));
  });
});

describe("the Lusitania split for a What-if", () => {
  let whole: ShipPartData;
  beforeAll(() => {
    whole = buildShipPart(r, "whole", null, "high");
  });

  it("builds whole with every funnel and boat", () => {
    expect(whole.funnels).toEqual([0, 1, 2, 3]);
    expect(whole.boats).toHaveLength(48);
    expect(whole.drums.length).toBeGreaterThan(0);
  });

  it.each([-20, 25, 60, -90])(
    "splits at x = %p with every piece on one side",
    (breakX) => {
      const bow = buildShipPart(r, "bow", breakX, "high");
      const stern = buildShipPart(r, "stern", breakX, "high");
      const A = TEAR_AMPLITUDE + 1e-6;
      const xs = (d: ShipPartData, key: "hull" | "deck") => {
        const out: number[] = [];
        for (let i = 0; i < d[key].pos.length; i += 3) out.push(d[key].pos[i]);
        return out;
      };
      for (const x of [...xs(bow, "hull"), ...xs(bow, "deck")])
        expect(x).toBeGreaterThanOrEqual(breakX - A);
      for (const x of [...xs(stern, "hull"), ...xs(stern, "deck")])
        expect(x).toBeLessThanOrEqual(breakX + A);
      const same = <T>(key: keyof ShipPartData, id: (v: T) => string) => {
        const all = (whole[key] as T[]).map(id).sort();
        const halves = [
          ...(bow[key] as T[]).map(id),
          ...(stern[key] as T[]).map(id),
        ].sort();
        expect(halves).toEqual(all);
      };
      const at = (p: { p: number[] }) => p.p.join(",");
      same("portholes", at);
      same("windows", at);
      same("vents", at);
      same("drums", at);
      same("funnels", (i: number) => String(i));
      same("boats", (i: number) => String(i));
      for (const l of bow.portholes) expect(sideOf(breakX, ...l.p)).toBe("bow");
    }
  );
});
