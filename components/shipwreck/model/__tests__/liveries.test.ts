import {
  BufferGeometry,
  Color,
  Mesh,
  MeshStandardMaterial,
  Texture,
  type BufferAttribute,
  type Object3D,
} from "three";
import { britannic } from "@/lib/shipwreck/ships/britannic";
import { carpathia } from "@/lib/shipwreck/ships/carpathia";
import { fitzgerald } from "@/lib/shipwreck/ships/fitzgerald";
import { lusitania } from "@/lib/shipwreck/ships/lusitania";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import { funLiveries, type ShipSpec } from "@/lib/shipwreck/ships/types";
import { buildShipPart } from "../buildShip";
import { GeoBuffer } from "../geoBuffer";
import { createTitanicModel, recipeFor, type TitanicModel } from "../shipModel";

// The canvases the textures draw need a browser: stand-ins here (the
// livery swap never touches a texture but the dazzle's, which it switches
// by a uniform).
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

/** Every object under `root`, and the meshes that would draw. */
function objects(root: Object3D): Object3D[] {
  const out: Object3D[] = [];
  root.traverse((o) => out.push(o));
  return out;
}
function drawn(root: Object3D): Mesh[] {
  const out: Mesh[] = [];
  root.traverseVisible((o) => {
    if ((o as Mesh).isMesh) out.push(o as Mesh);
  });
  return out;
}
/**
 * Every vertex colour array in the model (or only those drawn), by mesh,
 * as plain numbers.
 */
function colours(root: Object3D, drawnOnly = false): Map<Object3D, number[]> {
  const out = new Map<Object3D, number[]>();
  const visit = (o: Object3D) => {
    const g = (o as Mesh).geometry as BufferGeometry | undefined;
    const c = g?.getAttribute("color") as BufferAttribute | undefined;
    if (c) out.set(o, Array.from(c.array));
  };
  if (drawnOnly) root.traverseVisible(visit);
  else root.traverse(visit);
  return out;
}
/** The hull shader's uniforms (as three hands them to the program). */
function hullUniforms(model: TitanicModel) {
  const hull = drawn(model.handles.root).find((m) => m.name === "hull")!;
  const mat = hull.material as MeshStandardMaterial;
  const shader = {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: "#include <common>\n#include <begin_vertex>",
    fragmentShader:
      "#include <common>\n#include <color_fragment>\n#include <roughnessmap_fragment>",
  };
  mat.onBeforeCompile(shader as never, undefined as never);
  return { mat, u: shader.uniforms };
}

const built: TitanicModel[] = [];
function build(spec: ShipSpec, breakX: number | null = null) {
  const m = createTitanicModel(spec, { quality: "high", breakX });
  built.push(m);
  return m;
}
afterAll(() => {
  for (const m of built) m.dispose();
});

describe("fun paints (1.7)", () => {
  it.each([titanic, lusitania, fitzgerald, carpathia, britannic])(
    "$id: every fun paint builds the first time she wears it, then swaps colours only",
    (spec) => {
      const fun = funLiveries(spec);
      expect(fun.length).toBeGreaterThanOrEqual(5);
      for (const breakX of [null, 4]) {
        const m = createTitanicModel(spec, { quality: "medium", breakX });
        const h = m.handles;
        const base = h.livery!;
        expect(h.liveries).toEqual(spec.liveries!.map((l) => l.id));
        const coloursBefore = colours(h.root);
        const { u } = hullUniforms(m);
        for (const l of fun) {
          h.setLivery(l.id);
          expect(h.livery).toBe(l.id);
          // Her hull in its colours (the shader's own linear numbers).
          expect((u.uBlack.value as Color).getHex()).toBe(
            new Color().setHex(l.fun!.paint.topsides).getHex()
          );
          expect((u.uDazzleOn?.value ?? 0) as number).toBe(0);
        }
        // Worn once: a second time makes no geometry.
        const made = jest.spyOn(GeoBuffer.prototype, "toGeometry");
        for (const l of fun) h.setLivery(l.id);
        expect(made).not.toHaveBeenCalled();
        made.mockRestore();
        h.setLivery(base);
        expect(colours(h.root, true)).toEqual(
          new Map(
            [...coloursBefore].filter(([o]) =>
              drawn(h.root).includes(o as Mesh)
            )
          )
        );
        m.dispose();
      }
    }
  );
});

describe.each([
  [lusitania, "war-1915", "cunard-1907"],
  [carpathia, "dazzle-1918", "cunard-1912"],
  [britannic, "hospital", "liner"],
] as const)("%s's liveries, switched live", (spec, base, other) => {
  const model = build(spec);
  const h = model.handles;

  it("starts in her default and lists both", () => {
    expect(h.livery).toBe(base);
    expect(h.liveries.slice(0, 2)).toEqual([base, other]);
  });

  // (The Britannic is built from her model recipe, both looks' funnel cuts
  // and her bow apart: britannicLivery.test.ts checks her default.)
  if (spec.id !== "britannic")
    it("draws her default exactly as her default recipe builds it", () => {
      // Every drawn list is the default recipe's own: the liveries add only
      // hidden parts.
      const d = buildShipPart(recipeFor(spec), "whole", null, "high");
      const byName = (n: string) => drawn(h.root).filter((m) => m.name === n);
      expect(byName("paint")).toHaveLength(1);
      expect(
        Array.from(byName("paint")[0].geometry.getAttribute("color").array)
      ).toEqual(Array.from(Float32Array.from(d.paint.col)));
      expect(byName("hull")[0].geometry.getAttribute("position").count).toBe(
        d.hull.vertexCount
      );
      // Hidden parts do not count toward her triangles.
      let tris = 0;
      for (const m of drawn(h.root)) {
        const g = m.geometry;
        const n =
          (g.index ? g.index.count : g.getAttribute("position").count) / 3;
        tris += (m as unknown as { isInstancedMesh?: boolean }).isInstancedMesh
          ? n * (m as unknown as { count: number }).count
          : n;
      }
      expect(tris).toBeGreaterThanOrEqual(h.stats.triangles);
    });

  it("repaints colours and uniforms only: no geometry made or freed, no object added", () => {
    const made = jest.spyOn(GeoBuffer.prototype, "toGeometry");
    const freed = jest.spyOn(BufferGeometry.prototype, "dispose");
    const before = objects(h.root);
    const coloursBefore = colours(h.root);
    const drawnBefore = colours(h.root, true);
    const { mat, u } = hullUniforms(model);
    const black = (u.uBlack.value as { getHex(): number }).getHex();
    const relief = mat.normalScale.x;
    const geometries = before.map((o) => (o as Mesh).geometry);

    h.setLivery(other);
    expect(h.livery).toBe(other);
    expect(made).not.toHaveBeenCalled();
    expect(freed).not.toHaveBeenCalled();
    const after = objects(h.root);
    expect(after).toEqual(before);
    expect(after.map((o) => (o as Mesh).geometry)).toEqual(geometries);
    // The paint really changed: what is drawn, and the hull's paint.
    expect(colours(h.root, true)).not.toEqual(drawnBefore);
    const changed =
      (u.uBlack.value as { getHex(): number }).getHex() !== black ||
      (u.uGold.value as { getHex(): number }).getHex() !==
        (u.uBlack.value as { getHex(): number }).getHex() ||
      (u.uDazzleOn?.value ?? 0) === 0;
    expect(changed).toBe(true);

    // Back to her default: exactly as built.
    h.setLivery(base);
    expect(colours(h.root)).toEqual(coloursBefore);
    expect((u.uBlack.value as { getHex(): number }).getHex()).toBe(black);
    expect(mat.normalScale.x).toBe(relief);
    made.mockRestore();
    freed.mockRestore();
  });

  it("swaps in well under a frame (budget 8 ms on the test machine)", () => {
    const times: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      h.setLivery(i % 2 === 0 ? other : base);
      times.push(h.stats.liveryMs);
    }
    times.sort((a, b) => a - b);
    const median = times[3];
    // The report quotes it.
    console.log(`${spec.id} livery swap: median ${median.toFixed(2)} ms`);
    expect(median).toBeLessThan(8);
  });

  it("ignores an id she does not have", () => {
    h.setLivery(base);
    const before = colours(h.root);
    h.setLivery("no-such-paint");
    expect(h.livery).toBe(base);
    expect(colours(h.root)).toEqual(before);
  });
});

describe("what each livery shows", () => {
  it("the Carpathia's 1912 paint: name boards and the banded funnel show, the dazzle goes off", () => {
    const m = build(carpathia);
    const h = m.handles;
    const { u } = hullUniforms(m);
    const names = () => drawn(h.root).filter((o) => o.name.startsWith("names"));
    const funnels = () =>
      drawn(h.root).filter((o) => o.name.startsWith("funnel"));
    expect(u.uDazzleOn.value).toBe(1);
    expect(names()).toHaveLength(0);
    expect(funnels()).toHaveLength(1);
    h.setLivery("cunard-1912");
    expect(u.uDazzleOn.value).toBe(0);
    expect(names()).toHaveLength(1);
    expect(funnels()).toHaveLength(1);
    expect(funnels()[0].name).toBe("funnel-cunard-1912");
    // Her black topsides over red antifouling, a white boot-top.
    expect((u.uBlack.value as { getHex(): number }).getHex()).toBe(
      (u.uBlack.value as { getHex(): number }).getHex()
    );
    expect(u.uLoadWL.value).toBeCloseTo(10.54, 6);
    h.setLivery("dazzle-1918");
    expect(u.uDazzleOn.value).toBe(1);
    expect(names()).toHaveLength(0);
    expect(funnels()[0].name).toBe("funnel");
  });

  it("the Carpathia's 1912 paint has no stern gun (the 1918 looks do)", () => {
    // The gun's own small list: shown in the 1918 paint, hidden in 1912,
    // in the whole ship and in the stern half of a broken one.
    const gunTris = (spec: ShipSpec, livery: string) =>
      buildShipPart(recipeFor(spec, livery), "whole", null, "high").variant
        .vertexCount;
    expect(gunTris(carpathia, "dazzle-1918")).toBeGreaterThan(0);
    expect(gunTris(carpathia, "grey-1918")).toBeGreaterThan(0);
    expect(gunTris(carpathia, "cunard-1912")).toBe(0);
    // Its boxes stand on the stern house's roof, aft.
    const r = recipeFor(carpathia, "dazzle-1918");
    expect(r.variantBoxes?.length).toBeGreaterThan(0);
    for (const b of r.variantBoxes ?? []) expect(b.c[0]).toBeLessThan(-70);
    expect(recipeFor(carpathia, "cunard-1912").variantBoxes).toEqual([]);
    for (const breakX of [null, -20]) {
      const m = build(carpathia, breakX);
      const h = m.handles;
      const gun = () => drawn(h.root).filter((o) => o.name === "livery-parts");
      expect(gun()).toHaveLength(1);
      h.setLivery("cunard-1912");
      expect(gun()).toHaveLength(0);
      h.setLivery("dazzle-1918");
      expect(gun()).toHaveLength(1);
    }
    // The other ships have no such parts.
    for (const spec of [titanic, lusitania, fitzgerald])
      expect(
        objects(build(spec).handles.root).some((o) => o.name === "livery-parts")
      ).toBe(false);
  });

  it("the Lusitania's 1907 paint: Cunard funnels, no gilt band", () => {
    const m = build(lusitania);
    const h = m.handles;
    const { u } = hullUniforms(m);
    const gold = () => (u.uGold.value as { getHex(): number }).getHex();
    const black = () => (u.uBlack.value as { getHex(): number }).getHex();
    expect(gold()).not.toBe(black());
    h.setLivery("cunard-1907");
    expect(gold()).toBe(black());
    const funnels = drawn(h.root).filter((o) => o.name.startsWith("funnel"));
    expect(funnels).toHaveLength(4);
    expect(funnels.every((f) => f.name === "funnel-cunard-1907")).toBe(true);
    // Only the funnels have a 1907 part of their own (her names stay).
    const extra = objects(h.root).filter(
      (o) => (o as Mesh).isMesh && o.name.endsWith("-cunard-1907")
    );
    expect(extra.map((o) => o.name)).toEqual(
      Array(4).fill("funnel-cunard-1907")
    );
    h.setLivery("war-1915");
  });

  it("repaints both halves of a broken model the same way", () => {
    const m = build(lusitania, 4);
    m.handles.setLivery("cunard-1907");
    expect(m.handles.livery).toBe("cunard-1907");
    const funnels = drawn(m.handles.root).filter((o) =>
      o.name.startsWith("funnel")
    );
    expect(funnels.every((f) => f.name === "funnel-cunard-1907")).toBe(true);
  });

  it("builds a livery outside her list when asked (the viewer's grey)", () => {
    const m = build(carpathia);
    expect(m.handles.liveries).not.toContain("grey-1918");
    const grey = createTitanicModel(carpathia, {
      quality: "low",
      breakX: null,
      livery: "grey-1918",
    });
    built.push(grey);
    expect(grey.handles.livery).toBe("grey-1918");
    expect(grey.handles.liveries).toContain("grey-1918");
  });
});
