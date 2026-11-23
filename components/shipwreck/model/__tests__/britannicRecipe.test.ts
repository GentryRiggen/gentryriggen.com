import * as fs from "fs";
import * as path from "path";
import {
  BRITANNIC_BOATS,
  BRITANNIC_FUNNEL_PAINTS,
  BRITANNIC_GANTRY_SETS,
  BRITANNIC_PAINT,
  britannic,
} from "@/lib/shipwreck/ships/britannic";
import { fitzgerald } from "@/lib/shipwreck/ships/fitzgerald";
import { lusitania } from "@/lib/shipwreck/ships/lusitania";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import { buildShipPart } from "../buildShip";
import {
  BRIDGE_NUMBER,
  bandPaintAt,
  britannicRecipe,
} from "../britannicRecipe";
import { recipeFor } from "../shipModel";
import {
  swungOutY,
  titanicRecipe,
  type ShipRecipe,
  type V3,
} from "../titanicRecipe";

const r = britannicRecipe(britannic);
const { hull, layout: L } = r;
const edge = (x: number) => hull.topHalfBreadth(x);
const band = r.paint!.band!;
const sheer = britannic.sheerZ;

/** Inside the ship's plan outline (a little slack), keel to masthead. */
function withinHull(p: V3, slack = 0.15): boolean {
  const [x, y, z] = p;
  if (x < hull.xMin - slack || x > hull.xMax + slack) return false;
  if (Math.abs(y) > edge(x) + slack + 0.6) return false;
  return z >= -slack && z <= 75;
}

describe("Britannic recipe", () => {
  it("is what the model builds for her; the others keep theirs", () => {
    expect(recipeFor(britannic).spec).toBe(britannic);
    expect(recipeFor(britannic).paint?.name).toBe("BRITANNIC");
    expect(recipeFor(titanic).paint).toBeUndefined();
    for (const s of [titanic, lusitania, fitzgerald]) {
      expect(recipeFor(s).gantries).toBeUndefined();
      expect(recipeFor(s).hinge).toBeUndefined();
      expect(recipeFor(s).paint?.band).toBeUndefined();
    }
  });

  it("is her sister's hull at her own 94 ft beam", () => {
    const t = titanicRecipe(titanic);
    expect(L.stemX).toBe(t.layout.stemX);
    expect(L.sternX).toBe(t.layout.sternX);
    expect(2 * edge(0)).toBeGreaterThan(28.5);
    expect(2 * edge(0)).toBeLessThan(28.8);
    expect(edge(0)).toBeGreaterThan(t.hull.topHalfBreadth(0) + 0.2);
  });

  it("keeps every placement on the ship", () => {
    for (const l of r.lights) expect(withinHull(l.p)).toBe(true);
    for (const b of r.boats) expect(withinHull([b.x, b.y, b.z])).toBe(true);
    for (const d of r.davits)
      expect(withinHull([d.x, d.footY, d.z])).toBe(true);
    for (const p of [...r.vents, ...r.benches, ...r.bollards])
      expect(withinHull(p.p)).toBe(true);
    for (const b of r.boxes ?? []) expect(withinHull(b.c)).toBe(true);
    for (const g of r.gantries!)
      for (const x of g.arms)
        expect(withinHull([x, g.footY, g.deckZ])).toBe(true);
  });

  it("has four buff funnels, the fourth a dummy with no steam", () => {
    expect(r.funnels).toHaveLength(4);
    r.funnels.forEach((f, i) => {
      expect(f.x).toBe(britannic.funnels[i].x);
      expect(f.dummy).toBe(i === 3);
      expect(f.hasWhistle).toBe(i !== 3);
      // Plain buff in her hospital ship photographs: no deep black top,
      // only a sooty lip.
      expect(f.blackTop).toBeLessThan(1);
    });
    expect(r.paint!.funnel).toBe(0xbb7f3a);
    expect(r.paint!.mast).toBe(0xbb7f3a);
  });

  it("has her five gantry sets where R5 puts them, six boats each", () => {
    const g = r.gantries!;
    expect(g).toHaveLength(5);
    g.forEach((set, i) => {
      const data = BRITANNIC_GANTRY_SETS[i];
      expect(set.x).toBe(data.x);
      expect(set.side).toBe(data.side);
      const s = set.side === "port" ? 1 : -1;
      expect(Math.sign(set.footY)).toBe(s);
      expect(Math.abs(set.footY)).toBeGreaterThan(edge(set.x) - 1);
      const boats = r.boats.filter((b) => b.gantry === i);
      expect(boats).toHaveLength(6);
      for (const b of boats) {
        // In the bay between the two arms, on the set's side.
        expect(b.x - b.length / 2).toBeGreaterThan(Math.min(...set.arms));
        expect(b.x + b.length / 2).toBeLessThan(Math.max(...set.arms));
        expect(b.side).toBe(set.side);
        expect(b.hasDavits).toBe(false);
      }
      expect(set.height).toBeGreaterThan(6);
    });
    // One forward to starboard, four aft.
    expect(g.filter((s) => s.x > 0).map((s) => s.side)).toEqual(["starboard"]);
  });

  it("draws her 48 boats as the data has them, Welin davits for the rest", () => {
    expect(r.boats).toHaveLength(48);
    r.boats.forEach((b, i) => {
      const d = BRITANNIC_BOATS[i];
      expect(b.index).toBe(d.index);
      expect(b.side).toBe(d.side);
      expect(b.x).toBe(d.x);
      expect(b.gantry !== undefined).toBe(d.kind === "gantry");
      expect(Math.sign(b.y)).toBe(b.side === "port" ? 1 : -1);
      expect(Math.abs(b.y) + b.beam / 2).toBeLessThan(edge(b.x));
      expect(b.deckZ).toBeCloseTo(r.deckZ("Boat", b.x), 6);
      expect(b.z).toBeGreaterThanOrEqual(b.deckZ);
    });
    // Welin: a pair of davits over each outboard boat, the inboard one
    // under the same pair (double-banked).
    const welin = r.boats.filter((b) => b.gantry === undefined);
    expect(welin).toHaveLength(18);
    const outboard = welin.filter((b) => b.hasDavits);
    expect(outboard).toHaveLength(9);
    expect(r.davits).toHaveLength(18);
    for (const b of outboard) {
      const ds = r.davits.filter((d) => d.boat === b.index);
      expect(ds).toHaveLength(2);
      for (const d of ds) {
        expect(d.footY).toBe(b.edgeY);
        // Turned in over the outboard boat, as they stood that morning.
        expect(d.headY).toBe(b.y);
        expect(Math.abs(swungOutY(b))).toBeGreaterThan(Math.abs(d.footY));
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

  it("clears the boats of benches, vents and houses", () => {
    for (const b of r.boats) {
      const inside = (p: V3, pad: number) =>
        Math.abs(p[0] - b.x) < b.length / 2 + pad &&
        Math.abs(p[1] - b.y) < b.beam / 2 + pad;
      for (const p of [...r.benches, ...r.vents])
        expect(inside(p.p, 0.3)).toBe(false);
      for (const h of r.houses) {
        const overlapX = h.x0 < b.x + b.length / 2 && h.x1 > b.x - b.length / 2;
        const overlapY = h.y0 < b.y + b.beam / 2 && h.y1 > b.y - b.beam / 2;
        expect(overlapX && overlapY).toBe(false);
      }
    }
  });

  it("has three propellers and one rudder, as her sisters", () => {
    expect(r.propellers).toHaveLength(3);
    expect(r.propellers.map((p) => p.blades).sort()).toEqual([3, 3, 4]);
    expect(r.rudder.outline.length).toBeGreaterThan(4);
    const xs = r.rudder.outline.map(([x]) => x);
    expect(Math.min(...xs)).toBeGreaterThan(L.sternX - 0.5);
  });

  it("draws her open porthole rows open, where the sim floods", () => {
    const ports = r.lights.filter((l) => l.kind === "porthole");
    for (const row of britannic.portholes ?? []) {
      const s = row.side === "port" ? 1 : -1;
      const mid = (row.fromX + row.toX) / 2;
      const rowZ = (x: number) =>
        row.followsSheer ? row.z + sheer(x) - sheer(mid) : row.z;
      const onRow = ports.filter(
        (l) =>
          Math.sign(l.p[1]) === s &&
          l.p[0] >= row.fromX - 0.1 &&
          l.p[0] <= row.toX + 0.1 &&
          Math.abs(l.p[2] - rowZ(l.p[0])) < 0.05
      );
      const xs = onRow.map((l) => l.p[0]).sort((a, b) => a - b);
      expect(xs[0]).toBeLessThan(row.fromX + 4);
      expect(xs[xs.length - 1]).toBeGreaterThan(row.toX - 4);
      for (let i = 1; i < xs.length; i += 1)
        expect(xs[i] - xs[i - 1]).toBeLessThan(5);
      // About half open (the data's area), the rest shut.
      const open = onRow.filter((l) => l.open).length;
      expect(open / onRow.length).toBeGreaterThan(0.35);
      expect(open / onRow.length).toBeLessThan(0.75);
      // No closed row of her sister's left over beside it (within 0.5 m).
      const stray = ports.filter(
        (l) =>
          !onRow.includes(l) &&
          Math.sign(l.p[1]) === s &&
          l.p[0] > row.fromX + 0.6 &&
          l.p[0] < row.toX - 0.6 &&
          Math.abs(l.p[2] - rowZ(l.p[0])) < 0.5
      );
      expect(stray).toEqual([]);
    }
    // Only the sim's rows are open.
    const open = ports.filter((l) => l.open);
    for (const l of open)
      expect(
        (britannic.portholes ?? []).some(
          (row) =>
            l.p[0] >= row.fromX - 0.1 &&
            l.p[0] <= row.toX + 0.1 &&
            Math.sign(l.p[1]) === (row.side === "port" ? 1 : -1)
        )
      ).toBe(true);
  });

  it("paints the green band and three red crosses a side", () => {
    expect(r.paint!.sheerLine).toBeNull();
    expect(r.paint!.hull!.topsides).toBeGreaterThan(0xc0c0c0);
    expect(band.crosses).toHaveLength(3);
    // Forward under the foremast, amidships by the third funnel, aft by
    // the poop (her photographs).
    const [fwd, mid, aft] = [...band.crosses].sort((a, b) => b - a);
    expect(Math.abs(fwd - r.masts[0].x)).toBeLessThan(6);
    expect(Math.abs(mid - britannic.funnels[2].x)).toBeLessThan(8);
    expect(aft).toBeLessThan(-100);
    for (const x of band.crosses) {
      const zc = band.z + band.follow * (sheer(x) - sheer(0));
      // On the topsides, under the sheer, well above the boot-topping.
      expect(zc + band.crossSize / 2).toBeLessThan(sheer(x) - 0.3);
      expect(zc - band.crossSize / 2).toBeGreaterThan(L.loadWaterline + 2);
      expect(bandPaintAt(band, x, zc, sheer(x), sheer(0))).toBe("red");
      expect(
        bandPaintAt(band, x, zc + band.crossSize * 0.4, sheer(x), sheer(0))
      ).toBe("red");
      expect(
        bandPaintAt(band, x + band.crossSize * 0.4, zc, sheer(x), sheer(0))
      ).toBe("red");
      // White round the cross: the band stops short of it.
      expect(
        bandPaintAt(
          band,
          x + band.crossSize * 0.4,
          zc + band.crossSize * 0.4,
          sheer(x),
          sheer(0)
        )
      ).toBeNull();
      expect(
        bandPaintAt(band, x + band.gap / 2 - 0.1, zc, sheer(x), sheer(0))
      ).toBeNull();
    }
    // Green from stem to stern between the crosses, and only in the band.
    for (const x of [120, 40, -60, -130]) {
      const zc = band.z + band.follow * (sheer(x) - sheer(0));
      expect(bandPaintAt(band, x, zc, sheer(x), sheer(0))).toBe("green");
      expect(
        bandPaintAt(band, x, zc + band.height, sheer(x), sheer(0))
      ).toBeNull();
      expect(
        bandPaintAt(band, x, zc - band.height, sheer(x), sheer(0))
      ).toBeNull();
    }
  });

  it("has two red crosses each side on the boat deck", () => {
    const red = (r.boxes ?? []).filter((b) => b.color === band.crossColor);
    for (const s of [1, -1]) {
      const side = red.filter((b) => Math.sign(b.c[1]) === s);
      const xs = new Set(side.map((b) => Math.round(b.c[0])));
      expect(xs.size).toBe(2);
      for (const b of side) {
        expect(b.c[2]).toBeGreaterThan(r.deckZ("Boat", b.c[0]));
        expect(Math.abs(b.c[1])).toBeGreaterThan(edge(b.c[0]) - 1);
      }
    }
  });

  it("carries G.618 on her bridge front and her name at the bow", () => {
    expect(BRIDGE_NUMBER).toBe("G.618");
    const board = (r.boxes ?? []).filter(
      (b) =>
        Math.abs(b.c[0] - L.boatDeckTo) < 0.6 &&
        b.c[2] > r.deckZ("Boat", L.boatDeckTo)
    );
    // A black board and the white strokes of five characters on it.
    expect(board.some((b) => b.color < 0x303030)).toBe(true);
    expect(board.filter((b) => b.color > 0xe0e0e0).length).toBeGreaterThan(12);
    expect(r.names.filter((n) => n.where === "bow")).toHaveLength(2);
    expect(r.paint!.letters).toBeDefined();
  });

  it("hangs her anchors from the hawse pipes, below the band", () => {
    expect(r.anchors).toHaveLength(2);
    for (const a of r.anchors) {
      expect(a.hawse).toBe(true);
      expect(a.pocket).toBeUndefined();
      const [x, , z] = a.p;
      const zc = band.z + band.follow * (sheer(x) - sheer(0));
      // The pipe's mouth (1.4 m over p) above the band, the crown under it.
      expect(z + 1.4).toBeGreaterThan(zc + band.height / 2);
      expect(z - 2.6).toBeLessThan(zc - band.height / 2);
      expect(x).toBeGreaterThan(r.masts[0].x + 20);
    }
  });

  it("encloses A deck aft and opens the forward screens", () => {
    const A = r.deckIndex("A");
    const side = r.lights.filter((l) => l.deck === A && Math.abs(l.n[1]) > 0.5);
    const big = side.filter((l) => l.w >= 1.4);
    // Big promenade windows aft of the third funnel and at the forward
    // end; cabin windows between.
    expect(big.some((l) => l.p[0] < -20)).toBe(true);
    expect(big.some((l) => l.p[0] > L.boatDeckTo - 8)).toBe(true);
    expect(big.some((l) => l.p[0] > 5 && l.p[0] < 60)).toBe(false);
    expect(r.layout.promenadeEnclosedFrom).toBe(L.boatDeckFrom);
  });

  it("bends at the forward well (R12), clear of her masts and boats", () => {
    const h = r.hinge!;
    expect(h.x).toBeGreaterThan(L.bridgeDeckTo);
    expect(h.x).toBeLessThan(L.forecastleFrom);
    expect(h.z).toBeCloseTo(r.deckZ("C", h.x), 6);
    for (const m of r.masts) expect(Math.abs(m.x - h.x)).toBeGreaterThan(1);
    for (const b of r.boats) expect(b.x + b.length / 2).toBeLessThan(h.x);
    for (const hatch of r.hatches)
      expect(hatch.x0 > h.x || hatch.x1 < h.x).toBe(true);
  });

  it("builds within her budget at high", () => {
    const d = buildShipPart(r, "whole", null, "high");
    const tris =
      d.hull.triangleCount +
      d.paint.triangleCount +
      d.deck.triangleCount +
      d.bronze.triangleCount;
    expect(tris).toBeLessThan(260_000);
  });
});

// ---------------------------------------------------------------------------
// Her second livery (R23): the White Star liner she was built to be.

/**
 * Every data field of a recipe, the hull sampled, functions dropped (as
 * `titanicRecipeSnapshot.test.ts`).
 */
function serialize(x: ShipRecipe): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(x)) {
    if (k === "spec" || k === "hull" || typeof v === "function") continue;
    out[k] = v;
  }
  const sections: number[][] = [];
  for (let at = x.hull.xMin; at <= x.hull.xMax; at += 3.7) {
    const s = x.hull.section(at);
    sections.push([at, s.zb, s.zt, ...s.hb]);
  }
  out.hull = { xMin: x.hull.xMin, xMax: x.hull.xMax, sections };
  return JSON.parse(JSON.stringify(out));
}

/** The first place `now` differs from `before` (numbers to 1e-9), or null. */
function firstDiff(now: unknown, before: unknown, at: string): string | null {
  if (typeof before === "number" && typeof now === "number") {
    const scale = Math.max(1, Math.abs(now), Math.abs(before));
    return Math.abs(now - before) <= 1e-9 * scale ? null : `${at}: ${now}`;
  }
  if (before === null || typeof before !== "object")
    return now === before ? null : `${at}: ${JSON.stringify(now)}`;
  if (
    now === null ||
    typeof now !== "object" ||
    Array.isArray(now) !== Array.isArray(before)
  )
    return `${at}: ${JSON.stringify(now)}`;
  const n = now as Record<string, unknown>;
  const b = before as Record<string, unknown>;
  const extra = Object.keys(n).filter((k) => !(k in b));
  if (extra.length > 0) return `${at}: new fields ${extra.join(", ")}`;
  for (const k of Object.keys(b)) {
    if (!(k in n)) return `${at}.${k}: missing`;
    const d = firstDiff(n[k], b[k], `${at}.${k}`);
    if (d) return d;
  }
  return null;
}

describe("Britannic liveries (R23)", () => {
  const liner = britannicRecipe(britannic, "liner");
  const FIXTURE = path.join(__dirname, "fixtures", "britannicRecipe.json");
  if (process.env.UPDATE_RECIPE_SNAPSHOT) {
    fs.writeFileSync(FIXTURE, JSON.stringify(serialize(r)));
  }

  it("keeps the hospital ship as she was before the liner paint", () => {
    // Written after the 1.7 m band (R22), before the second livery.
    expect(BRITANNIC_PAINT).toBe("hospital");
    const before = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
    expect(firstDiff(serialize(r), before, "recipe")).toBeNull();
    expect(
      firstDiff(serialize(britannicRecipe(britannic, "hospital")), before, "r")
    ).toBeNull();
  });

  it("paints the liner black over red, a gold line, no band or crosses", () => {
    const p = liner.paint!;
    expect(p.band).toBeUndefined();
    // Black topsides (the default) over red antifouling to her load line.
    expect(p.hull?.topsides ?? 0x121315).toBeLessThan(0x303030);
    expect(liner.layout.loadWaterline).toBeCloseTo(10.54, 2);
    expect(liner.layout.loadWaterline).toBeLessThan(r.layout.loadWaterline);
    // The gold line under the sheer.
    expect(p.sheerLine).not.toBeNull();
    const gold = p.sheerLine!;
    expect(gold >> 16).toBeGreaterThan(0xb0);
    expect(gold & 0xff).toBeLessThan(0x70);
    // Gilt names (the default lettering), BRITANNIC / LIVERPOOL.
    expect(p.letters).toBeUndefined();
    expect(p.name).toBe("BRITANNIC");
    expect(p.port ?? "LIVERPOOL").toBe("LIVERPOOL");
    // No red crosses or G.618 anywhere.
    expect(liner.boxes ?? []).toEqual([]);
    expect(r.boxes!.length).toBeGreaterThan(0);
  });

  it("tops the liner's buff funnels in black, her sisters' depth", () => {
    const t = titanicRecipe(titanic);
    expect(liner.paint!.funnel).toBe(BRITANNIC_FUNNEL_PAINTS.liner.funnel);
    expect(liner.paint!.funnelTop).toBe(BRITANNIC_FUNNEL_PAINTS.liner.top);
    expect(liner.paint!.funnelTop).toBeLessThan(0x303030);
    expect(r.paint!.funnel).toBe(BRITANNIC_FUNNEL_PAINTS.hospital.funnel);
    expect(r.paint!.funnelTop).toBe(BRITANNIC_FUNNEL_PAINTS.hospital.top);
    liner.funnels.forEach((f, i) => {
      expect(f.blackTop).toBe(t.funnels[i].blackTop);
      expect(f.blackTop).toBeGreaterThan(4);
      expect({ ...f, blackTop: 0 }).toEqual({ ...r.funnels[i], blackTop: 0 });
    });
    expect(liner.paint!.mast).toBe(r.paint!.mast);
  });

  it("is the same ship under the paint", () => {
    // Only the paint, the paint line, the funnels' tops and the painted
    // boxes differ: the model swaps them without rebuilding.
    const same = (x: ShipRecipe) => {
      const s = serialize(x);
      for (const k of ["paint", "layout", "funnels", "boxes"]) delete s[k];
      return s;
    };
    expect(same(liner)).toEqual(same(r));
    expect({ ...liner.layout, loadWaterline: 0, bootTop: 0 }).toEqual({
      ...r.layout,
      loadWaterline: 0,
      bootTop: 0,
    });
  });

  it("is what recipeFor gives for each look; the others have one", () => {
    expect(recipeFor(britannic)).toBe(recipeFor(britannic, "hospital"));
    expect(recipeFor(britannic, "liner").paint?.band).toBeUndefined();
    expect(recipeFor(britannic, "liner")).toBe(recipeFor(britannic, "liner"));
    for (const s of [titanic, lusitania, fitzgerald])
      expect(recipeFor(s, "liner")).toBe(recipeFor(s));
  });
});
