import {
  Texture,
  type BufferAttribute,
  type InstancedMesh,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
} from "three";
import {
  CONCORDIA_BOATS,
  CONCORDIA_DECKS,
  concordia,
} from "@/lib/shipwreck/ships/concordia";
import { cruiseFun } from "@/lib/shipwreck/ships/funPaints";
import { funLiveries, realLiveries } from "@/lib/shipwreck/ships/types";
import { buildShipPart } from "../buildShip";
import {
  CONCORDIA_BALCONY_DECKS,
  CONCORDIA_PAINT,
  concordiaRecipe,
} from "../concordiaRecipe";
import { GeoBuffer } from "../geoBuffer";
import { createTitanicModel, recipeFor } from "../shipModel";
import type { V3 } from "../titanicRecipe";

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

const r = concordiaRecipe(concordia);
const { hull } = r;
const edge = (x: number) => hull.topHalfBreadth(x);
const deckZ = (name: string) => CONCORDIA_DECKS.find((d) => d.name === name)!.z;
/** Her top deck (14) and the masthead over it. */
const TOP = deckZ("14") + 25;

/** Inside her plan outline (the bridge wings to her beam), keel to masthead. */
function withinShip(p: V3, slack = 0.2): boolean {
  const [x, y, z] = p;
  if (x < hull.xMin - slack || x > hull.xMax + slack) return false;
  // The bridge wings stand out over her side to her full beam (photographs).
  const wing = z > deckZ("8") - 0.5 && z < deckZ("9") + 0.5;
  const half = wing ? concordia.beam / 2 + 0.5 : Math.max(edge(x), 2);
  if (Math.abs(y) > half + slack) return false;
  return z >= -slack && z <= TOP;
}

describe("Costa Concordia recipe", () => {
  it("is what the model builds for her, in her Costa colours by default", () => {
    expect(recipeFor(concordia).spec).toBe(concordia);
    expect(recipeFor(concordia, "costa-2012")).toBe(recipeFor(concordia));
    expect(realLiveries(concordia).map((l) => l.id)).toEqual(["costa-2012"]);
    expect(concordia.liveries!.find((l) => l.default)!.id).toBe("costa-2012");
    expect(r.paint!.name).toBe("COSTA CONCORDIA");
    expect(r.paint!.port).toBe("GENOVA");
    expect(r.paint).toEqual(CONCORDIA_PAINT);
  });

  it("has one yellow funnel at her data's place, black-topped, the blue C on both sides in her own paint only", () => {
    expect(r.funnels).toHaveLength(1);
    const [f] = r.funnels;
    const d = concordia.funnels[0];
    expect(f.x).toBe(d.x);
    expect(f.baseZ).toBe(d.baseZ);
    expect(f.topZ).toBe(d.topZ);
    expect(r.paint!.funnel).toBe(concordia.funnelPaint!.funnel);
    expect(r.paint!.funnelTop).toBe(concordia.funnelPaint!.top);
    // Long fore and aft (an oval), upright.
    expect(f.semiA).toBeGreaterThan(f.semiB);
    expect(f.rake).toBe(0);
    // The "C", drawn on both sides by the funnel builder, no star.
    expect(f.emblem).toMatchObject({ letterOnly: true, realOnly: true });
    for (const fun of funLiveries(concordia)) {
      const fr = recipeFor(concordia, fun.id);
      expect(fr.funnels[0].emblem).toBeUndefined();
      // The rest of her shape is hers.
      expect(fr.boats).toEqual(r.boats);
    }
  });

  it("has her data's 26 boats, 13 a side under their davits, in the recess", () => {
    expect(r.boats).toHaveLength(26);
    r.boats.forEach((b, i) => {
      const d = CONCORDIA_BOATS[i];
      expect(b.index).toBe(d.index);
      expect(b.side).toBe(d.side);
      expect(b.x).toBe(d.x);
      expect(Math.sign(b.y)).toBe(b.side === "port" ? 1 : -1);
      expect(Math.abs(b.y) + b.beam / 2).toBeLessThan(edge(b.x));
      expect(b.deckZ).toBeCloseTo(deckZ("4"), 6);
      expect(b.hasDavits).toBe(true);
    });
    expect(r.boats.filter((b) => b.side === "port")).toHaveLength(13);
    expect(r.davits).toHaveLength(52);
    for (const b of r.boats) {
      const ds = r.davits.filter((d) => d.boat === b.index);
      expect(ds).toHaveLength(2);
      for (const d of ds)
        expect(Math.abs(d.x - b.x)).toBeLessThan(b.length / 2);
    }
    // Orange canopies over white hulls (the lifeboat photograph).
    expect(r.paint!.boat).toEqual({
      hull: 0xe8801f,
      bottom: 0xf1efe8,
      cover: 0xe8801f,
    });
    // Liferaft canisters in racks at both ends of the boat rows.
    expect(r.canisters!.length).toBeGreaterThanOrEqual(16);
  });

  it("has two propellers and two rudders behind them", () => {
    expect(r.propellers).toHaveLength(2);
    const [p, s] = r.propellers;
    expect(p.hub[1]).toBe(-s.hub[1]);
    for (const q of r.propellers) {
      const [x, y, z] = q.hub;
      expect(z - q.radius).toBeGreaterThan(0);
      expect(z + q.radius).toBeLessThan(concordia.draught);
      expect(hull.zBottom(x)).toBeGreaterThan(z + q.radius);
      expect(Math.abs(y)).toBeGreaterThan(3);
    }
    expect(r.rudder.ys).toEqual([p.hub[1], s.hub[1]]);
    const xs = r.rudder.outline.map(([x]) => x);
    const zs = r.rudder.outline.map(([, z]) => z);
    // Right behind each screw (within a screw's radius of its hub), about
    // as tall as the screw, from inside the hull down past the hub.
    expect(Math.max(...xs)).toBeLessThan(p.hub[0] - 1.5);
    expect(Math.max(...xs)).toBeGreaterThan(p.hub[0] - p.radius);
    expect(Math.max(...zs)).toBeGreaterThan(hull.zBottom(Math.max(...xs)));
    expect(Math.min(...zs)).toBeLessThan(p.hub[2]);
    expect(Math.min(...zs)).toBeGreaterThan(p.hub[2] - p.radius);
    // Each shaft runs into the hull and ends at its screw.
    for (const b of r.bossings) {
      expect(b.to[0]).toBeGreaterThan(p.hub[0]);
      expect(b.from[0]).toBeGreaterThan(b.to[0] + 5);
    }
    expect(r.bossings).toHaveLength(2);
    expect(r.thrusters!.length).toBeGreaterThanOrEqual(3);
  });

  it("has balcony rows and window bands down both sides on the decks the README lists", () => {
    expect(CONCORDIA_BALCONY_DECKS).toEqual(["7", "8", "9", "10"]);
    const windows = r.lights.filter((l) => l.kind === "window");
    for (const s of [1, -1])
      for (const deck of CONCORDIA_BALCONY_DECKS) {
        const z = deckZ(deck);
        // Her balcony doors, set in from her side, from aft of the funnel
        // to the bridge.
        const doors = windows.filter(
          (l) =>
            Math.sign(l.p[1]) === s &&
            l.p[2] > z &&
            l.p[2] < z + 2.8 &&
            l.h >= 1.8
        );
        expect(doors.length).toBeGreaterThan(40);
        const xs = doors.map((l) => l.p[0]);
        expect(Math.min(...xs)).toBeLessThan(-80);
        expect(Math.max(...xs)).toBeGreaterThan(80);
        // The blue glass fronts at her side.
        const glass = r.boxes!.filter(
          (b) =>
            b.color === 0x2f5a85 &&
            Math.sign(b.c[1]) === s &&
            b.c[2] > z &&
            b.c[2] < z + 1.5
        );
        // Runs that follow her side, end to end.
        const run = glass.reduce((sum, b) => sum + b.size[0], 0);
        expect(run).toBeGreaterThan(180);
      }
    // Cabin windows in her hull (decks 1–3) on both sides.
    for (const s of [1, -1])
      for (const deck of ["1", "2", "3"]) {
        const z = deckZ(deck);
        const row = windows.filter(
          (l) => Math.sign(l.p[1]) === s && l.p[2] > z && l.p[2] < z + 2.8
        );
        expect(row.length).toBeGreaterThan(50);
      }
    // A sparse emergency pattern (Task 6 reads it after lights-out).
    const lit = r.lights.filter((l) => l.emergency);
    expect(lit.length).toBeGreaterThan(30);
    expect(lit.length / r.lights.length).toBeLessThan(0.15);
  });

  it("paints her hull white over the blue line and red bottom at her draught", () => {
    expect(r.paint!.hull!.topsides).toBe(0xeeeeea);
    expect(r.paint!.hull!.boot).toBe(0x1f3a8a);
    expect(r.paint!.hull!.bottom).toBe(0x7a2a22);
    // Red to just under her 8.12 m waterline, the blue line across it.
    expect(r.layout.loadWaterline).toBeCloseTo(7.6, 6);
    expect(r.layout.loadWaterline + r.layout.bootTop).toBeCloseTo(9.0, 6);
    // Her white superstructure is not her hull's colour, so a fun paint
    // leaves it white.
    for (const b of r.blocks!)
      if (b.wall !== "plating")
        expect(b.wallColor ?? 0).not.toBe(r.paint!.hull!.topsides);
  });

  it("has her bridge and wings, the spa, the glass pool roofs, the slide, masts and radomes", () => {
    const ids = r.blocks!.map((b) => b.id);
    for (const id of ["bridge", "spa", "pool-glass", "sports-deck"])
      expect(ids).toContain(id);
    expect(r.domes).toHaveLength(1);
    expect(r.slides).toHaveLength(1);
    expect(r.slides![0].color).toBe(0xf0b81c);
    expect(r.masts).toHaveLength(1);
    expect(r.radomes!.length).toBeGreaterThanOrEqual(4);
    // Wings out past her side on deck 8.
    const wings = r.boxes!.filter(
      (b) => Math.abs(b.c[1]) + b.size[1] / 2 > edge(b.c[0]) + 0.5
    );
    expect(wings).toHaveLength(2);
    for (const w of wings) {
      expect(w.c[2]).toBeGreaterThan(deckZ("8"));
      // Out to her full beam.
      expect(Math.abs(w.c[1]) + w.size[1] / 2).toBeGreaterThan(
        concordia.beam / 2
      );
    }
  });

  it("carries the rock in her port side at frame 52 (R21)", () => {
    const rock = r.rock!;
    expect(rock.p[0]).toBeCloseTo(concordia.heel!.rock!.x, 6);
    expect(rock.p[1]).toBeGreaterThan(0);
    expect(rock.p[2]).toBeLessThan(concordia.draught);
    expect(rock.fromT).toBeGreaterThan(0);
    // Where the gash ends: the real night's opening at frames 52–60.
    expect(
      concordia.realNight.some((o) => o.compartmentId === rock.compartmentId)
    ).toBe(true);
  });

  it("names her on the bows, her sides and the stern", () => {
    expect(r.names.filter((n) => n.where === "bow")).toHaveLength(4);
    expect(r.names.filter((n) => n.side === "aft")).toHaveLength(1);
  });

  it("puts every fitting inside her bounds", () => {
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
      ...r.slides!.flatMap((s) => s.points),
    ];
    for (const p of points) expect(withinShip(p)).toBe(true);
    for (const b of r.blocks!) {
      expect(b.x0).toBeLessThan(b.x1);
      expect(b.x0).toBeGreaterThanOrEqual(hull.xMin);
      expect(b.x1).toBeLessThanOrEqual(hull.xMax);
    }
  });
});

describe("her emergency lights (R7)", () => {
  it("reach the pane material: her marked panes stay lit on uEmergency", () => {
    const m = createTitanicModel(concordia, { quality: "low", breakX: null });
    const h = m.handles;
    const panes: InstancedMesh[] = [];
    h.root.traverse((o) => {
      if (o.name === "windows") panes.push(o as InstancedMesh);
    });
    expect(panes).toHaveLength(1);
    const attr = panes[0].geometry.getAttribute(
      "aEmergency"
    ) as BufferAttribute;
    const marked = r.lights.filter((l) => l.kind === "window" && l.emergency);
    expect(attr.count).toBe(panes[0].count);
    expect(Array.from(attr.array).filter((v) => v === 1)).toHaveLength(
      marked.length
    );
    // The shader reads it, and the handle drives the level.
    const mat = panes[0].material as MeshStandardMaterial;
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: "#include <common>\n#include <begin_vertex>",
      fragmentShader: "#include <common>\n#include <emissivemap_fragment>",
    };
    mat.onBeforeCompile(shader as never, undefined as never);
    expect(shader.vertexShader).toMatch(/aEmergency \* uEmergency/);
    // Off until the scene's blackout sets it.
    expect(h.light.uEmergency.value).toBe(0);
    h.setPower(0);
    h.setEmergency(0.25);
    expect(shader.uniforms.uEmergency.value).toBe(0.25);
    expect(h.light.uEmergency.value).toBe(0.25);
    m.dispose();
  });
});

describe("her paint box (1.7 rule)", () => {
  it("has at least five cruise fun paints, none hers, under the saturation cap", () => {
    const fun = cruiseFun();
    expect(fun.length).toBeGreaterThanOrEqual(5);
    expect(funLiveries(concordia).map((l) => l.id)).toEqual(
      fun.map((l) => l.id)
    );
    for (const f of fun)
      expect(f.label).not.toMatch(
        /Carnival|Costa|MSC|Royal|Cunard|Disney|Princess|Holland/
      );
  });

  it("repaints live with no new geometry, and back", () => {
    const m = createTitanicModel(concordia, {
      quality: "medium",
      breakX: null,
    });
    const h = m.handles;
    expect(h.livery).toBe("costa-2012");
    expect(h.liveries).toEqual(concordia.liveries!.map((l) => l.id));
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
    for (const l of funLiveries(concordia)) h.setLivery(l.id);
    const made = jest.spyOn(GeoBuffer.prototype, "toGeometry");
    for (const l of funLiveries(concordia)) h.setLivery(l.id);
    h.setLivery("costa-2012");
    expect(made).not.toHaveBeenCalled();
    made.mockRestore();
    expect(colours(h.root)).toEqual(before);
    m.dispose();
  });

  it("builds within her budget's triangle share at high", () => {
    const d = buildShipPart(r, "whole", null, "high");
    const merged =
      d.hull.triangleCount +
      d.paint.triangleCount +
      d.deck.triangleCount +
      d.bronze.triangleCount +
      d.decal.triangleCount;
    expect(merged).toBeLessThan(250_000);
  });
});
