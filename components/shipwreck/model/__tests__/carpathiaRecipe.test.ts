import {
  CARPATHIA_AFTER_DECK,
  CARPATHIA_BOAT_PLATFORM,
  CARPATHIA_BOATS,
  CARPATHIA_FUNNEL_PAINT,
  CARPATHIA_FUNNEL_PAINTS,
  CARPATHIA_LIVERIES,
  CARPATHIA_MASTS,
  CARPATHIA_STERN_HOUSE,
  CARPATHIA_WELLS,
  carpathia,
} from "@/lib/shipwreck/ships/carpathia";
import { fitzgerald } from "@/lib/shipwreck/ships/fitzgerald";
import { lusitania } from "@/lib/shipwreck/ships/lusitania";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import { buildShipPart } from "../buildShip";
import {
  CARPATHIA_LIVERY_PAINT,
  carpathiaRecipe,
  type CarpathiaPaint,
} from "../carpathiaRecipe";
import { DAZZLE_COLORS, DAZZLE_GROUND, dazzleShapes } from "../dazzle";
import { recipeFor } from "../shipModel";
import type { V3 } from "../titanicRecipe";

const r = carpathiaRecipe(carpathia);
const { hull } = r;
const edge = (x: number) => hull.topHalfBreadth(x);
/** Her recipe's three paints, by livery id. */
const LOOKS: [string, CarpathiaPaint][] = [
  ["dazzle-1918", "dazzle"],
  ["grey-1918", "grey"],
  ["cunard-1912", "cunard"],
];

/** Inside the ship's plan outline (a little slack), keel to masthead. */
function withinHull(p: V3, slack = 0.15): boolean {
  const [x, y, z] = p;
  if (x < hull.xMin - slack || x > hull.xMax + slack) return false;
  if (Math.abs(y) > edge(x) + slack + 0.6) return false;
  return z >= -slack && z <= 60;
}

describe("Carpathia recipe", () => {
  it("is what the model builds for her, in her 1918 dazzle by default", () => {
    expect(CARPATHIA_LIVERIES.find((l) => l.default)?.id).toBe("dazzle-1918");
    expect(recipeFor(carpathia).spec).toBe(carpathia);
    expect(recipeFor(carpathia).paint?.dazzle).toBe(true);
    expect(recipeFor(carpathia)).toBe(recipeFor(carpathia, "dazzle-1918"));
    expect(recipeFor(carpathia, "cunard-1912")).not.toBe(recipeFor(carpathia));
    expect(r.paint?.name).toBe("CARPATHIA");
    // The other ships keep theirs (and ignore a paint).
    expect(recipeFor(titanic).paint).toBeUndefined();
    expect(recipeFor(titanic, "cunard-1912")).toBe(recipeFor(titanic));
    expect(recipeFor(fitzgerald).paint?.name).toBe("EDMUND FITZGERALD");
  });

  it.each(LOOKS)("paints her funnel for %s from her data", (id, look) => {
    expect(CARPATHIA_LIVERY_PAINT[id]).toBe(look);
    const p = carpathiaRecipe(carpathia, id).paint!;
    expect(p.funnel).toBe(CARPATHIA_FUNNEL_PAINTS[look].funnel);
    expect(p.funnelTop).toBe(CARPATHIA_FUNNEL_PAINTS[look].top);
  });

  it("wears dazzle, grey or 1912 Cunard: the livery picks hull, walls, bands and names", () => {
    expect(r.paint!.funnel).toBe(CARPATHIA_FUNNEL_PAINT.funnel);
    const dazzle = carpathiaRecipe(carpathia, "dazzle-1918");
    const grey = carpathiaRecipe(carpathia, "grey-1918");
    const cunard = carpathiaRecipe(carpathia, "cunard-1912");
    expect(dazzle.paint!.dazzle).toBe(true);
    expect(grey.paint!.dazzle).toBeUndefined();
    expect(cunard.paint!.dazzle).toBeUndefined();
    // Every look draws the walls into the dazzle list (one shape for every
    // livery); only dazzle paints them white for the texture.
    const house = (rec: typeof r) =>
      rec.blocks!.find((b) => b.id === "bridge-deck-house")!;
    for (const rec of [dazzle, grey, cunard]) {
      expect(house(rec).dazzle).toBe(true);
      expect(rec.houses.every((h) => h.dazzle)).toBe(true);
    }
    expect(house(dazzle).wallColor).toBe(0xffffff);
    expect(house(grey).wallColor).toBe(CARPATHIA_FUNNEL_PAINTS.grey.funnel);
    expect(house(cunard).wallColor).toBeUndefined();
    // Cunard: three black rings (P1, titanicinquiry), a black top, her name.
    expect(cunard.funnels[0].bands).toHaveLength(3);
    expect(cunard.names.length).toBeGreaterThan(0);
    expect(cunard.paint!.hull).toBeUndefined();
    // The war paints: grey all over, her name painted out.
    for (const rec of [dazzle, grey]) {
      expect(rec.funnels[0].bands).toHaveLength(0);
      expect(rec.names).toHaveLength(0);
      expect(rec.paint!.hull?.topsides).toBe(
        CARPATHIA_FUNNEL_PAINTS.grey.funnel
      );
    }
  });

  it("has one tall funnel where her data puts it", () => {
    expect(r.funnels).toHaveLength(1);
    const [f] = r.funnels;
    const d = carpathia.funnels[0];
    expect(f.x).toBe(d.x);
    expect(f.baseZ).toBe(d.baseZ);
    expect(f.topZ).toBe(d.topZ);
    expect(f.dummy).toBe(false);
    // Tall and slender: over three times as tall as it is wide.
    expect((f.topZ - f.baseZ) / (2 * f.semiA)).toBeGreaterThan(3);
    expect(f.x).toBeLessThan(r.layout.boatDeckTo);
    expect(f.x).toBeGreaterThan(r.layout.boatDeckFrom);
  });

  it("has four masts at her data's places, the main and mizzen tallest", () => {
    expect(r.masts.map((m) => m.id)).toEqual([
      "fore",
      "main",
      "mizzen",
      "jigger",
    ]);
    r.masts.forEach((m, i) => expect(m.x).toBe(CARPATHIA_MASTS[i]));
    const [fore, main, mizzen, jigger] = r.masts;
    expect(main.topZ).toBeGreaterThanOrEqual(fore.topZ);
    expect(main.topZ).toBeGreaterThan(jigger.topZ);
    expect(mizzen.topZ).toBeGreaterThan(jigger.topZ);
    // The funnel's top about 0.7 of the way from the water to the main
    // truck (the photographs).
    const k =
      (r.funnels[0].topZ - carpathia.draught) / (main.topZ - carpathia.draught);
    expect(k).toBeGreaterThan(0.6);
    expect(k).toBeLessThan(0.85);
    // Foremast and jigger in the wells, on the upper deck.
    expect(fore.baseZ).toBeCloseTo(r.deckZ("Upper", fore.x), 6);
    expect(jigger.baseZ).toBeCloseTo(r.deckZ("Upper", jigger.x), 6);
    // Derricks at every mast: two boxes in the mast's colour near each.
    for (const m of r.masts) {
      const near = r.boxes!.filter(
        (b) => b.color === r.paint!.mast && Math.abs(b.c[0] - m.x) < 10
      );
      expect(near.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("has her data's twenty boats under davits, none overlapping", () => {
    expect(r.boats).toHaveLength(CARPATHIA_BOATS.length);
    r.boats.forEach((b, i) => {
      const d = CARPATHIA_BOATS[i];
      expect(b.index).toBe(d.index);
      expect(b.label).toBe(d.label);
      expect(b.side).toBe(d.side);
      expect(b.x).toBe(d.x);
      // The data's keel is 1 m over the deck; the boat sits in chocks.
      expect(b.deckZ).toBeCloseTo(d.z - 1, 6);
      expect(b.z).toBeGreaterThan(b.deckZ);
      expect(Math.sign(b.y)).toBe(b.side === "port" ? 1 : -1);
      expect(Math.abs(b.y) + b.beam / 2).toBeLessThan(edge(b.x));
      expect(b.hasDavits).toBe(true);
    });
    expect(r.davits).toHaveLength(40);
    for (const b of r.boats) {
      const ds = r.davits.filter((d) => d.boat === b.index);
      expect(ds).toHaveLength(2);
      for (const d of ds) {
        expect(Math.abs(d.x - b.x)).toBeLessThan(b.length / 2);
        expect(d.footY).toBe(b.edgeY);
        expect(d.z).toBe(b.deckZ);
      }
    }
    for (const a of r.boats)
      for (const b of r.boats) {
        if (a === b) continue;
        const apart =
          Math.abs(a.x - b.x) >= (a.length + b.length) / 2 ||
          Math.abs(a.y - b.y) >= (a.beam + b.beam) / 2;
        expect(apart).toBe(true);
      }
  });

  it("has two three-bladed propellers and one rudder under the counter", () => {
    expect(r.propellers).toHaveLength(2);
    // thegreatoceanliners.com: "two three-bladed".
    for (const q of r.propellers) expect(q.blades).toBe(3);
    const [p, s] = r.propellers;
    expect(p.hub[1]).toBe(-s.hub[1]);
    for (const q of r.propellers) {
      const [x, y, z] = q.hub;
      expect(z - q.radius).toBeGreaterThan(0);
      expect(z + q.radius).toBeLessThan(carpathia.draught);
      expect(Math.abs(y) - q.radius).toBeGreaterThan(hull.halfBreadth(x, z));
      expect(x).toBeGreaterThan(hull.xMin);
    }
    expect(r.bossings).toHaveLength(2);
    const xs = r.rudder.outline.map(([x]) => x);
    const zs = r.rudder.outline.map(([, z]) => z);
    expect(Math.max(...xs)).toBeLessThan(-carpathia.lbp / 2);
    expect(Math.min(...xs)).toBeGreaterThan(hull.xMin);
    expect(Math.min(...zs)).toBeGreaterThan(0);
    expect(Math.max(...zs)).toBeLessThan(carpathia.draught + 1);
  });

  it("leaves the forward well open: no house or tier over it", () => {
    const w = CARPATHIA_WELLS.forward;
    const over = (x0: number, x1: number) =>
      x1 > w.fromX + 0.05 && x0 < w.toX - 0.05;
    for (const b of r.blocks!) {
      if (b.id.includes("well")) {
        // Only the well's deck and its bulwark, waist high.
        expect(b.h).toBeLessThan(1.3);
        continue;
      }
      expect(over(b.x0, b.x1)).toBe(false);
    }
    for (const h of r.houses) expect(over(h.x0, h.x1)).toBe(false);
    // The upper deck in the well sits a tier under the forecastle and the
    // house.
    const x = (w.fromX + w.toX) / 2;
    expect(w.z + carpathia.sheerZ(x) - carpathia.depth).toBeCloseTo(
      r.deckZ("Upper", x),
      6
    );
  });

  // Ruling R21: no raised poop.
  it("has an open after deck: no hull plating above the upper deck aft of the house", () => {
    const aft = (x0: number) => x0 < CARPATHIA_AFTER_DECK.toX - 0.05;
    for (const b of r.blocks!) {
      if (!aft(b.x0)) continue;
      expect(b.wall).not.toBe("plating");
      // Only its planking, no bulwark: open rails.
      expect(b.h).toBeLessThan(0.1);
    }
    expect(r.blocks!.some((b) => b.id.includes("poop"))).toBe(false);
    expect(r.layout.poopTo).toBe(CARPATHIA_AFTER_DECK.fromX);
    // Rails along both sides of the after deck, at the upper deck.
    const railsAft = r.rails.filter(
      (run) =>
        Math.min(...run.points.map((p) => p[0])) < hull.xMin + 1 &&
        Math.max(...run.points.map((p) => p[0])) > CARPATHIA_AFTER_DECK.toX - 1
    );
    expect(railsAft).toHaveLength(2);
    for (const run of railsAft)
      for (const [x, , z] of run.points)
        expect(z).toBeCloseTo(r.deckZ("Upper", x), 6);
    // Abaft the house only the stern deckhouse stands on it, inboard of
    // a walkway of a metre or more each side, one tier high.
    const houses = r.houses.filter((h) => aft(h.x0));
    expect(houses.map((h) => h.id)).toEqual(["stern-house"]);
    const [sh] = houses;
    expect(sh.x0).toBe(CARPATHIA_STERN_HOUSE.fromX);
    expect(sh.x1).toBe(CARPATHIA_STERN_HOUSE.toX);
    for (const x of [sh.x0, sh.x1])
      expect(edge(x) - sh.y1).toBeGreaterThanOrEqual(1);
    expect(sh.z0).toBeCloseTo(r.deckZ("Upper", sh.x0), 6);
    expect(sh.h).toBeLessThanOrEqual(2.7);
  });

  it("stands the jigger about 493 ft from the stem, a boat platform on stanchions forward of it", () => {
    const jigger = r.masts[3];
    expect(Math.abs(hull.xMax - 493 * 0.3048 - jigger.x)).toBeLessThanOrEqual(
      2
    );
    expect(jigger.baseZ).toBeCloseTo(r.deckZ("Upper", jigger.x), 6);
    // The platform's decks (one a side) and their stanchions.
    const pf = CARPATHIA_BOAT_PLATFORM;
    const parts = r.boxes!.filter(
      (b) => b.c[0] > pf.fromX - 0.1 && b.c[0] < pf.toX + 0.1
    );
    const decks = parts.filter((b) => b.size[1] > 2);
    expect(decks).toHaveLength(2);
    expect(parts.length - decks.length).toBeGreaterThanOrEqual(8);
    for (const d of decks)
      expect(d.c[0] - d.size[0] / 2).toBeGreaterThan(jigger.x);
    // A boat on each.
    const boats = r.boats.filter((b) => b.x > pf.fromX && b.x < pf.toX);
    expect(boats).toHaveLength(2);
    for (const b of boats)
      expect(b.deckZ).toBeCloseTo(r.deckZ("Bridge", b.x), 1);
  });

  it("puts every fitting inside her hull's bounds", () => {
    const points: V3[] = [
      ...r.vents.map((v) => v.p),
      ...r.bollards.map((b) => b.p),
      ...r.capstans.map((c) => c.p),
      ...r.lights.map((l) => l.p),
      ...r.boxes!.map((b) => b.c),
      ...r.rails.flatMap((run) => run.points),
      ...r.wires.flatMap((w) => [w.a, w.b]),
      ...r.funnelGuys.flat().flatMap((w) => [w.a, w.b]),
      ...r.anchors.map((a) => a.p),
      ...r.staffs!.map((s) => s.foot),
      ...r.hatches.map((h): V3 => [(h.x0 + h.x1) / 2, 0, h.z]),
      ...r.davits.map((d): V3 => [d.x, d.footY, d.z]),
      ...r.masts.map((m): V3 => [m.x, 0, m.baseZ]),
    ];
    for (const p of points) expect(withinHull(p)).toBe(true);
    for (const h of r.houses) {
      expect(h.x0).toBeLessThan(h.x1);
      for (const x of [h.x0, h.x1])
        expect(Math.max(-h.y0, h.y1)).toBeLessThan(edge(x));
    }
    for (const b of r.blocks!) {
      expect(b.x0).toBeLessThan(b.x1);
      expect(b.x0).toBeGreaterThanOrEqual(hull.xMin);
      expect(b.x1).toBeLessThanOrEqual(hull.xMax);
    }
  });

  it("builds her walls into the dazzle list in every livery, and no one else's", () => {
    const d = buildShipPart(r, "whole", null, "high");
    expect(d.dazzle.triangleCount).toBeGreaterThan(100);
    const plain = buildShipPart(
      carpathiaRecipe(carpathia, "cunard-1912"),
      "whole",
      null,
      "high"
    );
    // The same walls (the livery switches the dazzle off in its material).
    expect(plain.dazzle.triangleCount).toBe(d.dazzle.triangleCount);
    for (const spec of [titanic, lusitania, fitzgerald])
      expect(
        buildShipPart(recipeFor(spec), "whole", null, "low").dazzle
          .triangleCount
      ).toBe(0);
  });
});

describe("the dazzle scheme", () => {
  const L = hull.xMax - hull.xMin;
  const H = 28;
  const sides = ["port", "starboard"] as const;

  it("is deterministic, in the 1918 palette, and her two sides differ", () => {
    for (const side of sides)
      expect(dazzleShapes(side, L, H)).toEqual(dazzleShapes(side, L, H));
    expect(dazzleShapes("port", L, H)).not.toEqual(
      dazzleShapes("starboard", L, H)
    );
    for (const side of sides) {
      const shapes = dazzleShapes(side, L, H);
      expect(shapes[0].color).toBe(DAZZLE_GROUND);
      const used = new Set(shapes.map((s) => s.color));
      for (const c of used) expect(DAZZLE_COLORS[c]).toBeDefined();
      // Black, white and a blue-grey at least: bold contrast.
      for (const c of ["black", "white", "blueGrey"] as const)
        expect(used.has(c)).toBe(true);
    }
  });

  it("is bold slanted shapes crossing the hull, not stripes", () => {
    for (const side of sides) {
      const shapes = dazzleShapes(side, L, H).slice(1);
      expect(shapes.length).toBeGreaterThanOrEqual(15);
      for (const s of shapes) {
        // Every shape has a slanted edge (no upright or level stripes).
        const slanted = s.pts.some((p, i) => {
          const q = s.pts[(i + 1) % s.pts.length];
          const dx = Math.abs(q[0] - p[0]);
          const dz = Math.abs(q[1] - p[1]);
          return dz > 1 && dx / dz > 0.3;
        });
        expect(slanted).toBe(true);
      }
      // Shapes start along the whole length, stern to stem.
      const starts = shapes.map((s) => Math.min(...s.pts.map((p) => p[0])));
      expect(Math.min(...starts)).toBeLessThan(0.1 * L);
      expect(Math.max(...starts)).toBeGreaterThan(0.6 * L);
    }
  });
});
