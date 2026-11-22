import {
  FITZGERALD_BOATS,
  FITZGERALD_HATCHES,
  fitzgerald,
} from "@/lib/shipwreck/ships/fitzgerald";
import { lusitania } from "@/lib/shipwreck/ships/lusitania";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import { TEAR_AMPLITUDE, sideOf } from "../breakCut";
import { buildShipPart, counterX, type ShipPartData } from "../buildShip";
import { APERTURE, FENCE_GAP, fitzgeraldRecipe } from "../fitzgeraldRecipe";
import { createHullSurface } from "../hullSurface";
import { recipeFor } from "../shipModel";
import type { V3 } from "../titanicRecipe";

const FT = 0.3048;
const r = fitzgeraldRecipe(fitzgerald);
const { hull, layout: L } = r;
const edge = (x: number) => hull.topHalfBreadth(x);
const brokenVents = (fitzgerald.deckOpenings ?? []).filter(
  (o) => o.kind === "vent"
);

/** Inside the ship's plan outline (a little slack), keel to mast top. */
function withinHull(p: V3, slack = 0.15): boolean {
  const [x, y, z] = p;
  if (x < hull.xMin - slack || x > hull.xMax + slack) return false;
  if (Math.abs(y) > edge(x) + slack + 0.6) return false;
  return z >= -slack && z <= 45;
}

describe("Edmund Fitzgerald recipe", () => {
  it("is what the model builds for her; the liners keep theirs", () => {
    expect(recipeFor(fitzgerald).spec).toBe(fitzgerald);
    expect(recipeFor(fitzgerald).paint?.name).toBe("EDMUND FITZGERALD");
    expect(recipeFor(fitzgerald).paint?.port).toBe("MILWAUKEE");
    expect(recipeFor(lusitania).paint?.name).toBe("LUSITANIA");
    expect(recipeFor(titanic).paint).toBeUndefined();
  });

  it("spans her hull, stem to round stern, her houses where the data puts them", () => {
    expect(L.sternX).toBe(fitzgerald.stations[0].x);
    expect(L.stemX).toBe(fitzgerald.stations[fitzgerald.stations.length - 1].x);
    const sup = fitzgerald.superstructure;
    // Forward: the forecastle from its after end to the stem, the texas
    // tier on it; aft: the house from the stern to No. 21's after side.
    expect(L.forecastleFrom).toBe(sup[3].fromX);
    expect(L.poopTo).toBe(sup[2].toX);
    expect(L.boatDeckFrom).toBe(sup[1].fromX);
    expect(L.boatDeckTo).toBe(sup[1].toX);
    const block = (id: string) => r.blocks!.find((b) => b.id === id)!;
    expect(block("texas-house").x0).toBe(sup[4].fromX);
    expect(block("texas-house").x1).toBe(sup[4].toX);
    expect(block("after-house").x1).toBe(sup[2].toX);
    expect(block("after-tier").x0).toBe(sup[1].fromX);
    expect(block("after-tier").x1).toBe(sup[1].toX);
    // No superstructure between the houses: a laker's open deck.
    for (const b of r.blocks!)
      if (b.h > 0.1 && !b.id.startsWith("crane"))
        expect([
          b.id,
          b.x0 >= L.forecastleFrom - 0.01 || b.x1 <= L.poopTo + 0.01,
        ]).toEqual([b.id, true]);
  });

  it("has one funnel, on the after house, where the data puts it", () => {
    expect(r.funnels).toHaveLength(1);
    const [f] = r.funnels;
    const d = fitzgerald.funnels[0];
    expect([f.x, f.baseZ, f.topZ, f.dummy]).toEqual([
      d.x,
      d.baseZ,
      d.topZ,
      false,
    ]);
    expect(f.x).toBeGreaterThan(L.boatDeckFrom);
    expect(f.x).toBeLessThan(L.boatDeckTo);
    expect(f.baseZ).toBeCloseTo(r.deckZ("After house top", f.x), 2);
    // Columbia's colours: dark red, a buff band with the star, black top.
    expect(f.stripes!.length).toBeGreaterThanOrEqual(1);
    expect(f.emblem).toBeDefined();
    expect(f.blackTop).toBeLessThan(f.topZ - f.baseZ);
  });

  it("has 21 hatch covers over her 21 hatches, on their coamings", () => {
    expect(r.hatches).toHaveLength(FITZGERALD_HATCHES.length);
    const openings = new Map(
      (fitzgerald.deckOpenings ?? []).map((o) => [o.id, o])
    );
    r.hatches.forEach((h, i) => {
      const data = FITZGERALD_HATCHES[i];
      expect((h.x0 + h.x1) / 2).toBeCloseTo(data.x, 6);
      // The cover rests on the coaming's top, where the sim's opening is.
      expect(h.z).toBeCloseTo(openings.get(data.id)!.z, 6);
      // 11 by 48 ft hatches; the coaming round each 11 ft 7 in by 54 ft
      // (it stands 3 ft outboard of the opening, USCG), the cover over it.
      expect(h.coaming).toBeDefined();
      expect(2 * h.coaming!.hx).toBeCloseTo((11 + 7 / 12) * FT, 2);
      expect(2 * h.coaming!.hw).toBeCloseTo(54 * FT, 2);
      expect(h.x1 - h.x0).toBeGreaterThan(2 * h.coaming!.hx);
      expect(h.hw).toBeGreaterThan(h.coaming!.hw);
      expect(h.hw).toBeLessThan(edge(data.x) - 1.5);
    });
    // Covers clear of one another on 24 ft centres.
    for (let i = 1; i < r.hatches.length; i += 1)
      expect(r.hatches[i - 1].x0).toBeGreaterThan(r.hatches[i].x1);
  });

  it("has her boats in the data's order: two lifeboats aft, two rafts", () => {
    expect(r.boats).toHaveLength(FITZGERALD_BOATS.length);
    r.boats.forEach((b, i) => {
      const d = FITZGERALD_BOATS[i];
      expect(b.index).toBe(d.index);
      expect(b.label).toBe(d.label);
      expect(b.side).toBe(d.side);
      expect(b.x).toBe(d.x);
      expect(b.kind).toBe(d.kind === "lifeboat" ? "lifeboat" : "collapsible");
      expect(b.hasDavits).toBe(d.kind === "lifeboat");
      expect(b.deckZ).toBeCloseTo(r.deckZ(d.deck, b.x), 6);
      expect(b.z).toBeGreaterThanOrEqual(b.deckZ);
      expect(b.z).toBeLessThan(b.deckZ + 1.5);
      if (d.side === "centre") expect(b.y).toBe(0);
      else expect(Math.sign(b.y)).toBe(d.side === "port" ? 1 : -1);
      expect(Math.abs(b.y) + b.beam / 2).toBeLessThan(edge(b.x));
    });
    // Two davits a lifeboat, at its ends, feet at the deck edge.
    expect(r.davits).toHaveLength(4);
    for (const b of r.boats.filter((x) => x.hasDavits)) {
      const ds = r.davits.filter((d) => d.boat === b.index);
      expect(ds).toHaveLength(2);
      for (const d of ds) {
        expect(Math.abs(d.x - b.x)).toBeLessThan(b.length / 2);
        expect(d.footY).toBe(b.edgeY);
      }
    }
    // The lifeboats stand clear of the house beside them.
    const tier = r.blocks!.find((b) => b.id === "after-tier")!;
    for (const b of r.boats.filter((x) => x.kind === "lifeboat"))
      expect(Math.abs(b.y) - b.beam / 2).toBeGreaterThan(
        edge(b.x) - (tier.inset ?? 0)
      );
  });

  it("has one propeller and one rudder under her stern", () => {
    expect(r.propellers).toHaveLength(1);
    const [p] = r.propellers;
    const AP = -fitzgerald.lbp / 2;
    // 19.5 ft across (USCG), on the centre line, under the water.
    expect(2 * p.radius).toBeCloseTo(19.5 * FT, 2);
    expect(p.hub[1]).toBe(0);
    expect(p.hub[2] - p.radius).toBeGreaterThan(0);
    expect(p.hub[2] + p.radius).toBeLessThan(fitzgerald.draught);
    // In the aperture forward of the rudder post (the after perpendicular).
    expect(p.hub[0]).toBeGreaterThan(AP);
    expect(r.bossings).toHaveLength(0);
    const xs = r.rudder.outline.map(([x]) => x);
    const zs = r.rudder.outline.map(([, z]) => z);
    // Abaft the propeller's blades, hung on the rudder post at the after
    // perpendicular, below the water, its trailing edge under the
    // counter's end (not hanging off abaft it).
    expect(Math.max(...xs)).toBeLessThan(p.hub[0] - 1.6);
    expect(Math.max(...xs)).toBeLessThanOrEqual(AP);
    expect(Math.max(...xs)).toBeGreaterThan(AP - 0.5);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(L.sternX - 0.2);
    expect(Math.min(...zs)).toBeGreaterThan(0);
    expect(Math.max(...zs)).toBeLessThan(fitzgerald.draught);
    expect(r.rudder.stock).toBeDefined();
    expect(r.rudder.centre![0]).toBeLessThan(Math.max(...xs));
  });

  it("is missing the two vents and the fence rail she lost before 3:30 PM", () => {
    expect(brokenVents).toHaveLength(2);
    const vents = [...r.vents, ...(r.drums ?? [])];
    for (const v of brokenVents) {
      // Nothing stands where the vent was…
      for (const p of vents)
        expect(Math.hypot(p.p[0] - v.x, p.p[1] - v.y)).toBeGreaterThan(1);
      // …its twin to port still does, and a torn stub marks the place.
      expect(
        vents.some((p) => Math.hypot(p.p[0] - v.x, p.p[1] + v.y) < 0.3)
      ).toBe(true);
      expect(
        (r.boxes ?? []).some(
          (b) => Math.hypot(b.c[0] - v.x, b.c[1] - v.y) < 0.3
        )
      ).toBe(true);
    }
    // Two vents to each of her 16 ballast tanks (USCG), eight a side
    // (NTSB: three, two and three beside the holds): 32, less the two lost.
    expect(r.drums!.length).toBe(30);
    const tanks = fitzgerald.compartments.filter((c) =>
      /^tank[123]-[ps]$/.test(c.id)
    );
    const perHold: Record<string, number> = { 1: 3, 2: 2, 3: 3 };
    for (const t of tanks) {
      const n = perHold[t.id[4]];
      const s = t.id.endsWith("-p") ? 1 : -1;
      for (let k = 0; k < n; k += 1) {
        const x0 = t.fromX + ((t.toX - t.fromX) * k) / n;
        const x1 = t.fromX + ((t.toX - t.fromX) * (k + 1)) / n;
        const inTank = (x: number, y: number) =>
          x > x0 && x <= x1 && Math.sign(y) === s;
        const drawn = r.drums!.filter((d) => inTank(d.p[0], d.p[1])).length;
        const gone = brokenVents.filter((v) => inTank(v.x, v.y)).length;
        expect([t.id, k, drawn + gone]).toEqual([t.id, k, 2]);
      }
    }
    // The fence rail is down along her starboard side forward, over the
    // tanks the vents were on; the port rail runs on unbroken.
    const [g0, g1] = FENCE_GAP;
    for (const v of brokenVents) {
      expect(v.x).toBeGreaterThan(g0);
      expect(v.x).toBeLessThan(g1);
    }
    const deckZ = (x: number) => fitzgerald.sheerZ(x);
    const fence = r.rails.flatMap((run) =>
      run.points.filter((p) => Math.abs(p[2] - deckZ(p[0])) < 0.01)
    );
    const stbd = fence.filter((p) => p[1] < 0);
    const port = fence.filter((p) => p[1] > 0);
    expect(stbd.some((p) => p[0] > g0 + 0.5 && p[0] < g1 - 0.5)).toBe(false);
    expect(port.some((p) => p[0] > g0 + 0.5 && p[0] < g1 - 0.5)).toBe(true);
    expect(stbd.some((p) => p[0] < g0)).toBe(true);
    expect(stbd.some((p) => p[0] > g1)).toBe(true);
  });

  it("is drawn as the sim's hull at and below the water, bow to stern", () => {
    // The drawn bow and counter flare out above the water only: at and
    // below her draught the drawn hull is the offsets' own (within 5 cm:
    // the section's smoothing feels the flare a step away), so the water
    // plane cuts both alike.
    // The one exception: the propeller aperture, cut from the drawing only.
    const offsets = createHullSurface(fitzgerald);
    const AP = -fitzgerald.lbp / 2;
    const inAperture = (x: number, z: number) =>
      x < AP + APERTURE.fwd + 0.5 && z < APERTURE.top + 0.5;
    for (let x = hull.xMin; x <= hull.xMax; x += 0.25)
      for (let z = 0.05; z <= fitzgerald.draught + 1e-9; z += 0.1) {
        if (inAperture(x, z)) continue;
        const d = hull.halfBreadth(x, z) - offsets.halfBreadth(x, z);
        expect([x, z, Math.abs(d) < 0.05]).toEqual([x, z, true]);
      }
    // Well below the water, exactly.
    for (let x = hull.xMin; x <= hull.xMax; x += 0.5)
      for (let z = 0.05; z <= 6; z += 0.25)
        if (!inAperture(x, z))
          expect(hull.halfBreadth(x, z)).toBe(offsets.halfBreadth(x, z));
    // And the offsets surface follows the stations' own offsets.
    for (const st of fitzgerald.stations)
      for (const [z, hb] of st.offsets) {
        if (z > fitzgerald.draught || z <= st.offsets[0][0]) continue;
        if (inAperture(st.x, z)) continue;
        expect(Math.abs(hull.halfBreadth(st.x, z) - hb)).toBeLessThan(0.15);
      }
  });

  it("flares to her bow and counter without a crease", () => {
    // Along the hull above the water, away from the hull's own edges (the
    // stem, the counter's rim, the aperture), the breadth bends smoothly:
    // the larger of the offsets and a rounding crossed in a crease (a
    // second difference of 0.65 m at 0.25 m spacing); blended, it is
    // under 0.1 m.
    const h = 0.25;
    let worst = 0;
    for (const z of [9, 9.5, 10, 10.5, 11, 11.5, 12])
      for (let x = hull.xMin + 1; x < hull.xMax - 1; x += 0.25) {
        const b = [x - h, x, x + h].map((xi) => hull.halfBreadth(xi, z));
        if (b.some((v) => v === 0)) continue;
        if ([x - h, x, x + h].some((xi) => z - h < hull.zBottom(xi) + 1))
          continue;
        worst = Math.max(worst, Math.abs(b[0] - 2 * b[1] + b[2]));
      }
    expect(worst).toBeLessThan(0.1);
    // The drawn rows stand at the same heights from one section to the
    // next (folded onto each section's own bottom below it), so the mesh
    // never shears where the bottom climbs to the stem, the counter or
    // the aperture's top.
    const AP = -fitzgerald.lbp / 2;
    for (const x0 of [AP + APERTURE.fwd - 0.2, -110, 106, 107.5, 108.3]) {
      const a = hull.section(x0);
      const c = hull.section(x0 + 0.4);
      for (const u of [0.7, 0.8, 0.9, 1]) {
        const za = hull.zAtU(a, u);
        const zc = hull.zAtU(c, u);
        if (za <= (a.zCut ?? a.zb) + 1e-9 || zc <= (c.zCut ?? c.zb) + 1e-9)
          continue;
        expect(Math.abs(za - zc)).toBeLessThan(0.05);
      }
    }
  });

  it("turns her propeller in an open aperture under the counter", () => {
    const AP = -fitzgerald.lbp / 2;
    const offsets = createHullSurface(fitzgerald);
    const [p] = r.propellers;
    const [hx, , hz] = p.hub;
    // The blades' sweep (with their fore-and-aft spread) is open water in
    // the drawing, though the sim's offsets have deadwood there.
    let solidInSim = 0;
    // (stopping short of the sternpost's face, where the aperture ends)
    for (let x = hx - 0.7; x <= hx + 0.65; x += 0.1)
      for (let a = 0; a < 2 * Math.PI; a += Math.PI / 12)
        for (const rr of [0.7, 1.5, p.radius]) {
          const y = rr * Math.cos(a);
          const z = hz + rr * Math.sin(a);
          expect([x, y, z, hull.halfBreadth(x, z) <= Math.abs(y)]).toEqual([
            x,
            y,
            z,
            true,
          ]);
          if (offsets.halfBreadth(x, z) > Math.abs(y)) solidInSim += 1;
        }
    expect(solidInSim).toBeGreaterThan(0);
    // The sternpost forward of the hub, the aperture's top over the tips,
    // the sole piece under them, the rudder abaft them.
    expect(hx + 0.75).toBeGreaterThan(AP + APERTURE.fwd);
    expect(hz + p.radius).toBeLessThan(APERTURE.top - 0.2);
    expect(hull.halfBreadth(AP + APERTURE.fwd + 0.3, hz)).toBeGreaterThan(0);
    const sole = r.rudder.posts![0];
    expect(sole.c[2] + sole.size[2] / 2).toBeLessThan(hz - p.radius);
    expect(sole.c[0] + sole.size[0] / 2).toBeCloseTo(AP + APERTURE.fwd, 6);
  });

  it("has her anchors in pockets halfway down the bow", () => {
    expect(r.anchors).toHaveLength(2);
    for (const a of r.anchors) {
      const [x, , z] = a.p;
      const deck = fitzgerald.sheerZ(x);
      const wl = fitzgerald.draught;
      expect(a.pocket).toBeDefined();
      // The pocket's middle about halfway between the water and the deck,
      // the whole pocket clear of both.
      expect(Math.abs(z - (wl + deck) / 2)).toBeLessThan(0.5);
      expect(z - a.pocket!.h / 2).toBeGreaterThan(wl + 0.2);
      expect(z + a.pocket!.h / 2).toBeLessThan(deck - 0.4);
      expect(x).toBeGreaterThan(hull.xMax - 12);
    }
  });

  it("names her in big letters on the bow and the counter", () => {
    const bow = r.names.filter((n) => n.where === "bow" && n.x > 0);
    expect(bow).toHaveLength(2);
    for (const n of bow) expect(n.height).toBeGreaterThanOrEqual(1.2);
    expect(r.paint?.letters?.weight).toBe("heavy");
  });

  it("fits her name on the counter's curve, every letter facing aft", () => {
    // The board's columns as buildNames lays them: round the counter,
    // stood 0.07 m off along its normal. Under the letters (the texture's
    // middle 96%), at every row, the counter turns at most 30° from aft,
    // so none is hidden behind its curve from a quarter; and no chord
    // between columns cuts into the hull.
    const n = r.names.find((b) => b.side === "aft")!;
    const rows = n.rows ?? 1;
    expect(n.z + n.height / 2).toBeLessThan(fitzgerald.sheerZ(n.x) - 0.1);
    for (let j = 0; j <= rows; j += 1) {
      const z = n.z + (j / rows - 0.5) * n.height;
      const pts: [number, number][] = [];
      for (let i = 0; i <= 16; i += 1) {
        const u = i / 16;
        const y = (0.5 - u) * n.width;
        const e = 0.05;
        const slope = (counterX(r, y + e, z) - counterX(r, y - e, z)) / (2 * e);
        if (u >= 0.02 && u <= 0.98)
          expect((Math.atan(Math.abs(slope)) * 180) / Math.PI).toBeLessThan(30);
        const len = Math.hypot(1, slope);
        pts.push([counterX(r, y, z) - 0.07 / len, y + (0.07 * slope) / len]);
      }
      for (let i = 0; i < 16; i += 1)
        for (const f of [0.25, 0.5, 0.75]) {
          const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f;
          const y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f;
          expect(x).toBeLessThanOrEqual(counterX(r, y, z) + 0.005);
        }
    }
  });

  it("stands the pilothouse on the data's Pilothouse deck", () => {
    const ph = r.blocks!.find((b) => b.id === "pilothouse")!;
    expect(ph.deck).toBe("Texas");
    const x = (ph.x0 + ph.x1) / 2;
    const floor = r.deckZ("Pilothouse", x);
    // One tier from its floor to the visor; its glass at an officer's eye.
    expect(r.deckZ("Texas", x) + ph.h - floor).toBeCloseTo(2.6, 6);
    const glass = (r.boxes ?? []).filter(
      (b) =>
        b.color === 0x1b242c && b.c[0] >= ph.x0 - 0.1 && b.c[0] <= ph.x1 + 0.1
    );
    expect(glass.length).toBeGreaterThan(10);
    for (const g of glass) {
      expect(g.c[2] - floor).toBeGreaterThan(1.2);
      expect(g.c[2] - floor).toBeLessThan(2.2);
    }
  });

  it("has a radar mast, not a signal mast with a yard, on the pilothouse", () => {
    const [fore] = r.masts;
    expect(fore.yard).toBe(false);
    // Splayed legs from the roof up to the pole (boxes leaning in).
    const legs = (r.boxes ?? []).filter(
      (b) =>
        Math.abs(b.c[0] - fore.x) < 2 &&
        b.c[2] > fore.baseZ &&
        b.c[2] < fore.topZ &&
        Math.abs(b.pitch ?? 0) > 0.6
    );
    expect(legs.length).toBeGreaterThanOrEqual(4);
  });

  it("has her lights on the ship, on her own decks", () => {
    expect(r.lights.length).toBeGreaterThan(120);
    for (const l of r.lights) {
      expect([l.p, withinHull(l.p)]).toEqual([l.p, true]);
      expect(l.deck).toBeGreaterThanOrEqual(0);
      expect(l.deck).toBeLessThan(fitzgerald.decks.length);
      expect(l.seed).toBeGreaterThanOrEqual(0);
      expect(l.seed).toBeLessThan(1);
      expect(Math.hypot(...l.n)).toBeCloseTo(1, 6);
    }
    // Lit houses fore and aft, nothing amidships but the deck lights.
    const houseLights = r.lights.filter((l) => l.kind === "porthole");
    for (const l of houseLights)
      expect(l.p[0] > L.forecastleFrom - 0.5 || l.p[0] < L.poopTo + 0.5).toBe(
        true
      );
  });

  it("keeps every placement on the ship", () => {
    const points: V3[] = [
      ...r.vents.map((v) => v.p),
      ...(r.drums ?? []).map((v) => v.p),
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
      ...(r.bells ?? []).map((b) => b.p),
      ...r.masts.map((m): V3 => [m.x, 0, m.baseZ]),
      ...r.masts.map((m): V3 => [m.x, 0, m.topZ]),
      ...r.names.map((n): V3 => [n.x, 0, n.z]),
    ];
    for (const p of points) expect([p, withinHull(p)]).toEqual([p, true]);
    for (const b of r.blocks ?? []) {
      expect(b.x0).toBeLessThan(b.x1);
      expect(b.x0).toBeGreaterThanOrEqual(hull.xMin);
      expect(b.x1).toBeLessThanOrEqual(hull.xMax);
      expect(() => r.deckZ(b.deck, 0)).not.toThrow();
      if (b.halfWidth !== undefined)
        for (const x of [b.x0, b.x1]) expect(b.halfWidth).toBeLessThan(edge(x));
    }
    for (const h of r.houses)
      for (const x of [h.x0, h.x1])
        expect(Math.max(Math.abs(h.y0), Math.abs(h.y1))).toBeLessThan(edge(x));
    // Her bell on the pilothouse roof (where the 1995 dive found it).
    expect(r.bells).toHaveLength(1);
    const ph = r.blocks!.find((b) => b.id === "pilothouse")!;
    const [bx, , bz] = r.bells![0].p;
    expect(bx).toBeGreaterThan(ph.x0);
    expect(bx).toBeLessThan(ph.x1);
    expect(bz).toBeGreaterThan(r.deckZ(ph.deck, bx) + ph.h);
  });
});

describe("the Fitzgerald broken in two", () => {
  let whole: ShipPartData;
  beforeAll(() => {
    whole = buildShipPart(r, "whole", null, "high");
  });

  it("builds whole with her funnel and every boat", () => {
    expect(whole.funnels).toEqual([0]);
    expect(whole.boats).toHaveLength(FITZGERALD_BOATS.length);
  });

  // Near hatch No. 9, where her sim breaks as the bow strikes; and others.
  it.each([18, 23.3, 0, -40, 60])(
    "splits at x = %p with every piece on one side",
    (breakX) => {
      const bow = buildShipPart(r, "bow", breakX, "high");
      const stern = buildShipPart(r, "stern", breakX, "high");
      const A = TEAR_AMPLITUDE + 1e-6;
      const xs = (d: ShipPartData, key: "hull" | "deck" | "paint") => {
        const out: number[] = [];
        for (let i = 0; i < d[key].pos.length; i += 3) out.push(d[key].pos[i]);
        return out;
      };
      // The deck, the hatch covers and their coamings are cut by the tear
      // too (none hangs over the gap).
      const ends = (d: ShipPartData) => [
        ...xs(d, "hull"),
        ...xs(d, "deck"),
        ...xs(d, "paint").filter((x) => Math.abs(x - breakX) < 6),
      ];
      for (const x of ends(bow))
        expect(x).toBeGreaterThanOrEqual(breakX - A - 0.3);
      for (const x of ends(stern))
        expect(x).toBeLessThanOrEqual(breakX + A + 0.3);
      for (const x of xs(bow, "deck"))
        expect(x).toBeGreaterThanOrEqual(breakX - A);
      for (const x of xs(stern, "deck"))
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
      for (const l of bow.windows) expect(sideOf(breakX, ...l.p)).toBe("bow");
    }
  );
});
