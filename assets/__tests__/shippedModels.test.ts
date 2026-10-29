import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readGlb, type GltfJson } from "../glbFile";

/**
 * The glbs `npm run assets:ship` copies into public/ship-builder/models/ are
 * committed. These checks read each file's JSON chunk and compare it with the
 * part's spec, so a stale or hand-edited model fails here.
 */

const ROOT = join(__dirname, "..", "..");
const PARTS_DIR = join(ROOT, "assets", "parts");

/** Where a spec's committed glbs live: its game's models directory. */
function modelsDir(spec: { id: string; game?: string }): string {
  const game = spec.game === "plane" ? "plane-builder" : "ship-builder";
  return join(ROOT, "public", game, "models", spec.id);
}

interface Spec {
  id: string;
  game?: "plane";
  slots: string[];
  boundsTolerance: number;
  ao?: { strength?: number; slots?: Record<string, number> };
  variants: {
    name: string;
    expectedBounds: { min: number[]; max: number[] };
  }[];
}

function positionBounds(gltf: GltfJson): { min: number[]; max: number[] } {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const mesh of gltf.meshes) {
    for (const primitive of mesh.primitives) {
      const accessor = gltf.accessors[primitive.attributes.POSITION];
      if (!accessor?.min || !accessor.max) {
        throw new Error(`mesh ${mesh.name}: POSITION has no min/max`);
      }
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], accessor.min[i]);
        max[i] = Math.max(max[i], accessor.max[i]);
      }
    }
  }
  return { min, max };
}

const specs: Spec[] = readdirSync(PARTS_DIR)
  .filter((file) => file.endsWith(".json"))
  .map((file) => JSON.parse(readFileSync(join(PARTS_DIR, file), "utf8")));
const shipped = specs.filter((spec) => existsSync(modelsDir(spec)));
const cases = shipped.flatMap((spec) =>
  spec.variants.map((variant) => ({
    part: spec.id,
    variant: variant.name,
    spec,
    expectedBounds: variant.expectedBounds,
    path: join(modelsDir(spec), `${variant.name}.glb`),
  }))
);

describe("shipped models", () => {
  it("ships at least the funnel", () => {
    expect(shipped.map((spec) => spec.id)).toContain("funnel");
  });

  it("ships the Plane Builder pieces", () => {
    const planes = shipped.filter((spec) => spec.game === "plane");
    expect(planes.map((spec) => spec.id)).toContain("plane-fuselage");
  });

  it.each(shipped)("$id ships exactly its variants", (spec) => {
    const files = readdirSync(modelsDir(spec)).sort();
    const expected = spec.variants.map((v) => `${v.name}.glb`).sort();
    expect(files).toEqual(expected);
  });

  describe.each(cases)(
    "$part/$variant.glb",
    ({ spec, expectedBounds, path }) => {
      const gltf = readGlb(path).json;

      it("names every node and mesh by slot, one each", () => {
        const nodeNames = gltf.nodes.map((node) => node.name).sort();
        const meshNames = gltf.meshes.map((mesh) => mesh.name).sort();
        const slots = [...spec.slots].sort();
        expect(nodeNames).toEqual(slots);
        expect(meshNames).toEqual(slots);
      });

      it("carries baked AO (COLOR_0) on every slot not set to strength 0", () => {
        for (const mesh of gltf.meshes) {
          const strength =
            spec.ao?.slots?.[mesh.name ?? ""] ?? spec.ao?.strength ?? 0.7;
          for (const primitive of mesh.primitives) {
            const has = primitive.attributes.COLOR_0 !== undefined;
            expect([mesh.name, has]).toEqual([mesh.name, strength > 0]);
          }
        }
      });

      it("keeps every node untransformed and flat", () => {
        // The renderer and these bounds read mesh positions as-is.
        for (const node of gltf.nodes) {
          expect(node.children ?? []).toEqual([]);
          expect(node.matrix).toBeUndefined();
          expect(node.translation).toBeUndefined();
          expect(node.rotation).toBeUndefined();
          expect(node.scale).toBeUndefined();
        }
      });

      it("fits the spec's expected bounds", () => {
        const { min, max } = positionBounds(gltf);
        for (let i = 0; i < 3; i++) {
          expect(Math.abs(min[i] - expectedBounds.min[i])).toBeLessThanOrEqual(
            spec.boundsTolerance
          );
          expect(Math.abs(max[i] - expectedBounds.max[i])).toBeLessThanOrEqual(
            spec.boundsTolerance
          );
        }
      });
    }
  );
});
