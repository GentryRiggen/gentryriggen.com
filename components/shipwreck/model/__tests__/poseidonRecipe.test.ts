import { Texture, type BufferAttribute, type Mesh, type Object3D } from "three";
import { concordia } from "@/lib/shipwreck/ships/concordia";
import { cruiseFun } from "@/lib/shipwreck/ships/funPaints";
import {
  BALLROOM,
  POSEIDON_BOATS,
  POSEIDON_DECKS,
  POSEIDON_SUPERSTRUCTURE,
  poseidon,
} from "@/lib/shipwreck/ships/poseidon";
import { funLiveries, realLiveries } from "@/lib/shipwreck/ships/types";
import { buildShipPart } from "../buildShip";
import { GeoBuffer } from "../geoBuffer";
import {
  POSEIDON_BALCONY_DECKS,
  POSEIDON_PAINT,
  POSEIDON_WAVE_GOLD,
  poseidonRecipe,
} from "../poseidonRecipe";
import { createTitanicModel, recipeFor } from "../shipModel";
import type { ShipRecipe, V3 } from "../titanicRecipe";

// The textures draw into canvases: stand-ins here, as liveries.test.ts.
jest.mock("../textures", () => {
  const tex = () => new (jest.requireActual("three").Texture)() as Texture;
  return {
    acquireShipTextures: () => ({
      plateNormal: tex(),
      weathering: tex(),
      planks: tex(),
      names: tex(),
      dispose() {},
    }),
    releaseShipTextures() {},
    acquireDazzleTexture: () => tex(),
    releaseDazzleTexture() {},
  };
});

const r = poseidonRecipe(poseidon);
const { hull } = r;
const edge = (x: number) => hull.topHalfBreadth(x);
const deckZ = (name: string) => POSEIDON_DECKS.find((d) => d.name === name)!.z;
/** The dome's crown (9 m over deck 14, `poseidon.ts`) and the masthead. */
const TOP = 70;

/** Inside her plan outline (the bridge wings to her beam), keel to masthead. */
function withinShip(p: V3, slack = 0.2): boolean {
  const [x, y, z] = p;
  if (x < hull.xMin - slack || x > hull.xMax + slack) return false;
  const wing = z > deckZ("9") - 0.5 && z < deckZ("10") + 0.5;
  const half = wing ? poseidon.beam / 2 + 0.5 : Math.max(edge(x), 2);
  if (Math.abs(y) > half + slack) return false;
  return z >= -slack && z <= TOP;
}

/** Whether her boxes hold the tier's whole length and height. */
function inBoxes(x0: number, x1: number, zb: number, zt: number): boolean {
  for (let x = x0; x <= x1; x += Math.min(1, x1 - x0)) {
    const held = POSEIDON_SUPERSTRUCTURE.some(
      (b) =>
        x >= b.fromX - 0.01 &&
        x <= b.toX + 0.01 &&
        zb >= (b.baseZ ?? poseidon.depth) - 0.31 &&
        zt <= b.topZ + 0.01
    );
    if (!held) return false;
    if (x1 - x0 <= 0) break;
  }
  return true;
}

describe("the Poseidon's recipe", () => {
  it("is what the model builds for her, in her own colours by default", () => {
    expect(recipeFor(poseidon).spec).toBe(poseidon);
    expect(recipeFor(poseidon, "poseidon")).toBe(recipeFor(poseidon));
    expect(realLiveries(poseidon).map((l) => l.id)).toEqual(["poseidon"]);
    expect(r.paint).toEqual(POSEIDON_PAINT);
    expect(r.paint!.name).toBe("POSEIDON");
    expect(r.paint!.funnel).toBe(poseidon.funnelPaint!.funnel);
    expect(r.paint!.funnelTop).toBe(poseidon.funnelPaint!.top);
  });

  it("puts every tier inside her superstructure boxes, every fitting inside her", () => {
    for (const b of r.blocks!) {
      expect(b.x0).toBeLessThan(b.x1);
      expect(b.x0).toBeGreaterThanOrEqual(hull.xMin);
      expect(b.x1).toBeLessThanOrEqual(hull.xMax);
      // Her hull's plating carried up at the bow, and the deck on it.
      if (b.wall === "plating" || b.id === "foredeck") continue;
      const zb = deckZ(b.deck) + (b.dz ?? 0);
      expect([b.id, inBoxes(b.x0, b.x1, zb, zb + b.h)]).toEqual([b.id, true]);
    }
    const points: V3[] = [
      ...r.lights.map((l) => l.p),
      ...r.boxes!.map((b) => b.c),
      ...r.rails.flatMap((run) => run.points),
      ...r.anchors.map((a) => a.p),
      ...r.staffs!.map((s) => s.foot),
      ...r.davits.map((d): V3 => [d.x, d.footY, d.z]),
      ...r.masts.map((m): V3 => [m.x, 0, m.baseZ]),
      ...r.radomes!.map((d) => d.p),
      ...r.canisters!.map((c) => c.c),
    ];
    for (const p of points) expect([p, withinShip(p)]).toEqual([p, true]);
  });

  it("has one tall funnel at her data's place, raked 12°–18° and tapering, the gold wave in her own paint only", () => {
    expect(r.funnels).toHaveLength(1);
    const [f] = r.funnels;
    const d = poseidon.funnels[0];
    expect([f.x, f.baseZ, f.topZ]).toEqual([d.x, d.baseZ, d.topZ]);
    const deg = (f.rake * 180) / Math.PI;
    expect(deg).toBeGreaterThanOrEqual(12);
    expect(deg).toBeLessThanOrEqual(18);
    expect(f.taper!).toBeLessThan(1);
    expect(f.wing).toBeDefined();
    expect(f.wave).toMatchObject({ color: POSEIDON_WAVE_GOLD, realOnly: true });
    for (const fun of funLiveries(poseidon)) {
      const fr = recipeFor(poseidon, fun.id);
      expect(fr.funnels[0].wave).toBeUndefined();
      expect(fr.funnels[0].rake).toBe(f.rake);
      expect(fr.boats).toEqual(r.boats);
    }
  });

  it("has the ballroom's drum and dome inside her ballroom box, the dome at most 6k triangles and no draw call of its own", () => {
    expect(r.ballrooms).toHaveLength(1);
    const [b] = r.ballrooms!;
    // In plan, inside the box.
    expect(b.x - b.radius).toBeGreaterThanOrEqual(BALLROOM.fromX);
    expect(b.x + b.radius).toBeLessThanOrEqual(BALLROOM.toX);
    expect(b.radius + 0.45).toBeLessThanOrEqual(BALLROOM.halfBreadthM);
    // The drum from the box's floor up to deck 14, the dome over it: its
    // crown at the 9 m the data's ballroom states (README: the box's top
    // is a volume equivalent, not the crown).
    expect(b.z).toBe(BALLROOM.baseZ);
    expect(b.z + b.drumH).toBeLessThanOrEqual(deckZ("14"));
    expect(b.z + b.drumH + 0.5 + b.domeH).toBeLessThanOrEqual(deckZ("14") + 9);
    // The dome's share of her mesh, at high (the ribs included).
    const tris = (rr: ShipRecipe) => {
      const d = buildShipPart(rr, "whole", null, "high");
      return (
        d.paint.triangleCount +
        d.hull.triangleCount +
        d.deck.triangleCount +
        d.bronze.triangleCount +
        d.decal.triangleCount
      );
    };
    const without = { ...r, ballrooms: [] };
    const dome = tris(r) - tris(without);
    expect(dome).toBeGreaterThan(500);
    expect(dome).toBeLessThanOrEqual(6000);
    // Its lit panes are window lights (one instanced pane mesh for all).
    const panes = r.lights.filter((l) => l.p[2] > deckZ("14") + 0.4);
    expect(panes.length).toBeGreaterThanOrEqual(b.cols * (b.rows - 1));
    // Low tiers drop the ribs.
    const low = (rr: ShipRecipe) =>
      buildShipPart(rr, "whole", null, "low").paint.triangleCount;
    expect(low(r) - low(without)).toBeLessThan(dome / 2);
  });

  it("has her data's 24 boats, 12 a side under their davits, in the recess on deck 4", () => {
    expect(r.boats).toHaveLength(24);
    r.boats.forEach((b, i) => {
      const d = POSEIDON_BOATS[i];
      expect([b.index, b.side, b.x]).toEqual([d.index, d.side, d.x]);
      expect(Math.sign(b.y)).toBe(b.side === "port" ? 1 : -1);
      expect(Math.abs(b.y) + b.beam / 2).toBeLessThan(edge(b.x));
      expect(b.deckZ).toBeCloseTo(deckZ("4"), 6);
    });
    expect(r.boats.filter((b) => b.side === "port")).toHaveLength(12);
    expect(r.davits).toHaveLength(48);
    expect(r.paint!.boat!.cover).toBe(0xe8801f);
  });

  it("has two propellers and two rudders behind them, under her hull", () => {
    expect(r.propellers).toHaveLength(2);
    const [p, s] = r.propellers;
    expect(p.hub[1]).toBe(-s.hub[1]);
    for (const q of r.propellers) {
      const [x, , z] = q.hub;
      expect(z - q.radius).toBeGreaterThan(0);
      expect(z + q.radius).toBeLessThan(poseidon.draught);
      expect(hull.zBottom(x)).toBeGreaterThan(z + q.radius);
    }
    expect(r.rudder.ys).toEqual([p.hub[1], s.hub[1]]);
    const xs = r.rudder.outline.map(([x]) => x);
    expect(Math.max(...xs)).toBeLessThan(p.hub[0] - 1.5);
    expect(Math.min(...xs)).toBeGreaterThan(hull.xMin);
    for (const b of r.bossings) expect(b.from[0]).toBeGreaterThan(b.to[0] + 5);
  });

  it("has balcony rows decks 7–11 and window bands decks 1–6 on both sides", () => {
    expect(POSEIDON_BALCONY_DECKS).toEqual(["7", "8", "9", "10", "11"]);
    const on = (
      s: number,
      deck: string,
      f: (h: number) => boolean = () => true
    ) =>
      r.lights.filter(
        (l) =>
          Math.abs(l.n[1]) > 0.7 &&
          Math.sign(l.p[1]) === s &&
          l.p[2] > deckZ(deck) &&
          l.p[2] < deckZ(deck) + 2.8 &&
          f(l.h)
      );
    for (const s of [1, -1]) {
      for (const deck of POSEIDON_BALCONY_DECKS) {
        const doors = on(s, deck, (h) => h >= 1.8);
        expect(doors.length).toBeGreaterThan(40);
        const glass = r.boxes!.filter(
          (b) =>
            b.color === 0x355f7c &&
            Math.sign(b.c[1]) === s &&
            b.c[2] > deckZ(deck) &&
            b.c[2] < deckZ(deck) + 1.5
        );
        expect(glass.reduce((sum, b) => sum + b.size[0], 0)).toBeGreaterThan(
          190
        );
      }
      for (const deck of ["1", "2", "3", "4", "5", "6"])
        expect(on(s, deck).length).toBeGreaterThan(30);
    }
    const lit = r.lights.filter((l) => l.emergency);
    expect(lit.length).toBeGreaterThan(30);
    expect(lit.length / r.lights.length).toBeLessThan(0.15);
  });

  it("names her POSEIDON on both bows and the stern", () => {
    expect(r.names.map((n) => n.side)).toEqual(["port", "starboard", "aft"]);
    for (const n of r.names) expect(n.z).toBeLessThan(poseidon.depth);
  });
});

describe("her paint box (1.7 rule)", () => {
  it("is her real paint then the cruise fun paints: at least five, none hers", () => {
    const fun = cruiseFun();
    expect(fun.length).toBeGreaterThanOrEqual(5);
    expect(funLiveries(poseidon).map((l) => l.id)).toEqual(
      fun.map((l) => l.id)
    );
    const own = realLiveries(poseidon)[0];
    for (const f of fun) {
      expect([f.look.hull, f.look.funnel]).not.toEqual([
        own.look.hull,
        own.look.funnel,
      ]);
      // The gold wave is hers alone.
      expect(f.fun!.paint.funnel).not.toBe(POSEIDON_WAVE_GOLD);
    }
  });

  it("repaints live with no new geometry, and back", () => {
    const m = createTitanicModel(poseidon, { quality: "medium", breakX: null });
    const h = m.handles;
    expect(h.livery).toBe("poseidon");
    expect(h.liveries).toEqual(poseidon.liveries!.map((l) => l.id));
    const colours = (root: Object3D) => {
      const out: number[][] = [];
      root.traverseVisible((o) => {
        const c = (o as Mesh).geometry?.getAttribute("color") as
          BufferAttribute | undefined;
        if (c) out.push(Array.from(c.array));
      });
      return out;
    };
    const before = colours(h.root);
    for (const l of funLiveries(poseidon)) h.setLivery(l.id);
    const made = jest.spyOn(GeoBuffer.prototype, "toGeometry");
    for (const l of funLiveries(poseidon)) h.setLivery(l.id);
    h.setLivery("poseidon");
    expect(made).not.toHaveBeenCalled();
    made.mockRestore();
    expect(colours(h.root)).toEqual(before);
    m.dispose();
  });

  it("builds at high inside her budget: ≤ 300k triangles, about the Concordia's build time", () => {
    const m = createTitanicModel(poseidon, { quality: "high", breakX: null });
    expect(m.handles.stats.triangles).toBeLessThanOrEqual(300_000);
    let meshes = 0;
    m.handles.root.traverseVisible((o) => {
      if ((o as Mesh).isMesh) meshes += 1;
    });
    // Every drawn mesh one call at most (the scene's own passes aside).
    expect(meshes).toBeLessThanOrEqual(100);
    m.dispose();
    // Her part build against the Concordia's (median of 5), +20 % or less
    // with a little slack for a busy machine.
    const time = (rr: ShipRecipe) => {
      const ts: number[] = [];
      for (let i = 0; i < 5; i += 1) {
        const t0 = performance.now();
        buildShipPart(rr, "whole", null, "high");
        ts.push(performance.now() - t0);
      }
      return ts.sort((a, b) => a - b)[2];
    };
    const c = recipeFor(concordia);
    time(c);
    time(r);
    expect(time(r)).toBeLessThan(time(c) * 1.2 + 10);
  });
});
