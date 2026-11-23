import {
  BufferGeometry,
  Mesh,
  MeshStandardMaterial,
  Texture,
  type Material,
  type Object3D,
} from "three";
import { britannic } from "@/lib/shipwreck/ships/britannic";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import { createTitanicModel, type TitanicModel } from "../shipModel";

// jsdom has no 2d canvas: plain textures stand in, one name board per key.
jest.mock("../textures", () => {
  const { Texture: T } = jest.requireActual("three");
  const boards = new Map<string, unknown>();
  const shared = { plateNormal: new T(), weathering: new T(), planks: new T() };
  return {
    acquireShipTextures: (name = "TITANIC", style?: unknown) => {
      const key = `${name}|${JSON.stringify(style ?? null)}`;
      if (!boards.has(key)) boards.set(key, new T());
      return { ...shared, names: boards.get(key), dispose() {} };
    },
    releaseShipTextures: () => {},
  };
});

/** Everything the paint can change, as plain data. */
interface Look {
  geometries: BufferGeometry[];
  visible: boolean[];
  colors: number[][];
  uniforms: Record<string, unknown>;
  decal: { map: Texture | null; roughness: number; metalness: number };
}

function plain(v: unknown): unknown {
  if (v && typeof v === "object" && "isColor" in v) {
    const c = v as unknown as { r: number; g: number; b: number };
    return [c.r, c.g, c.b];
  }
  if (Array.isArray(v)) return v.map(plain);
  return v;
}

function look(model: TitanicModel): Look {
  const meshes: Mesh[] = [];
  model.handles.root.traverse((o: Object3D) => {
    if ((o as Mesh).isMesh) meshes.push(o as Mesh);
  });
  const mats = new Set<Material>(meshes.map((m) => m.material as Material));
  const hull = [...mats].find(
    (m) => (m as MeshStandardMaterial).userData.hullUniforms
  ) as MeshStandardMaterial;
  const decal = [...mats].find(
    (m) => (m as MeshStandardMaterial).transparent
  ) as MeshStandardMaterial;
  const uniforms: Record<string, unknown> = {};
  for (const [k, u] of Object.entries(
    hull.userData.hullUniforms as Record<string, { value: unknown }>
  ))
    uniforms[k] = plain(u.value);
  return {
    geometries: meshes.map((m) => m.geometry),
    visible: meshes.map((m) => {
      let o: Object3D | null = m;
      while (o) {
        if (!o.visible) return false;
        o = o.parent;
      }
      return true;
    }),
    colors: meshes.map((m) => {
      const c = m.geometry.getAttribute("color");
      return c ? Array.from(c.array as Float32Array) : [];
    }),
    uniforms,
    decal: {
      map: decal.map,
      roughness: decal.roughness,
      metalness: decal.metalness,
    },
  };
}

describe("the Britannic's paint swap (R23)", () => {
  const model = createTitanicModel(britannic, {
    quality: "high",
    breakX: null,
  });
  const hospital = look(model);

  afterAll(() => model.dispose());

  it("lists both looks, the hospital ship first, like every ship's liveries", () => {
    expect(model.handles.liveries).toEqual(["hospital", "liner"]);
    expect(model.handles.livery).toBe("hospital");
  });

  it("repaints her as a liner without rebuilding anything", () => {
    model.handles.setLivery("liner");
    expect(model.handles.livery).toBe("liner");
    const liner = look(model);
    // The same meshes and the same geometry objects.
    expect(liner.geometries).toHaveLength(hospital.geometries.length);
    liner.geometries.forEach((g, i) => expect(g).toBe(hospital.geometries[i]));
    // Black topsides, a gold line, the paint line at her load line, no band
    // or crosses.
    const u = liner.uniforms as Record<string, number[] & number>;
    expect(Math.max(...u.uBlack)).toBeLessThan(0.02);
    expect(u.uGold[0]).toBeGreaterThan(0.3);
    expect(u.uGold[0]).toBeGreaterThan(3 * u.uGold[2]);
    expect(u.uLoadWL).toBeCloseTo(10.54, 2);
    expect(u.uBand[3]).toBeLessThan(0);
    expect(u.uCross[3]).toBe(0);
    // Some vertex colours changed (the funnels' black tops), and a mesh
    // (the hospital's boat-deck crosses and G.618) is no longer drawn.
    expect(liner.colors).not.toEqual(hospital.colors);
    expect(liner.visible.filter((v) => v).length).toBeLessThan(
      hospital.visible.filter((v) => v).length
    );
    // Gilt names on another board.
    expect(liner.decal.map).not.toBe(hospital.decal.map);
    expect(liner.decal.metalness).toBeGreaterThan(hospital.decal.metalness);
    expect(model.handles.recipe.paint?.band).toBeUndefined();
  });

  it("puts her hospital paint back exactly", () => {
    model.handles.setLivery("liner");
    model.handles.setLivery("hospital");
    const back = look(model);
    back.geometries.forEach((g, i) => expect(g).toBe(hospital.geometries[i]));
    expect(back).toEqual(hospital);
    expect(model.handles.recipe.paint?.band).toBeDefined();
  });

  it("ignores a look she does not have", () => {
    model.handles.setLivery("dazzle");
    expect(look(model)).toEqual(hospital);
    expect(model.handles.livery).toBe("hospital");
  });

  it("builds in either paint the same as swapping to it", () => {
    const built = createTitanicModel(britannic, {
      quality: "high",
      breakX: null,
      livery: "liner",
    });
    model.handles.setLivery("liner");
    const a = look(built);
    const b = look(model);
    expect(a.uniforms).toEqual(b.uniforms);
    expect(a.colors).toEqual(b.colors);
    expect(a.visible).toEqual(b.visible);
    expect(a.decal).toEqual(b.decal);
    model.handles.setLivery("hospital");
    built.dispose();
  });
});

describe("a ship with one livery", () => {
  it("does nothing on setLivery", () => {
    const model = createTitanicModel(titanic, {
      quality: "low",
      breakX: null,
    });
    const before = look(model);
    model.handles.setLivery("liner");
    model.handles.setLivery("hospital");
    const after = look(model);
    after.geometries.forEach((g, i) => expect(g).toBe(before.geometries[i]));
    expect(after).toEqual(before);
    model.dispose();
  });
});
