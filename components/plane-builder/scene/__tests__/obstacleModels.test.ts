import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
} from "three";
import { PART_SPEC_LIST } from "@/assets/parts";
import { LEVELS } from "@/lib/plane-builder/levels";
import type { Obstacle, ObstacleKind } from "@/lib/plane-builder/levels/types";
import {
  FIXED_SLOT_COLORS,
  OBSTACLE_MODEL_URLS,
  OBSTACLE_TYPICAL_SIZE,
  OBSTACLE_VARIANTS,
  obstacleGeometryFromScene,
  obstacleVariant,
} from "../obstacleModels";

const ROOT = join(__dirname, "..", "..", "..", "..");
const KINDS = Object.keys(OBSTACLE_VARIANTS) as ObstacleKind[];

interface Spec {
  id: string;
  game?: string;
  slots: string[];
  variants: { name: string }[];
}

const specs = PART_SPEC_LIST as Spec[];

describe("obstacle models", () => {
  it("has a committed glb for every variant", () => {
    for (const url of OBSTACLE_MODEL_URLS) {
      expect(existsSync(join(ROOT, "public", url))).toBe(true);
    }
  });

  it.each(KINDS)(
    "%s has a plane spec naming its variants and a size",
    (kind) => {
      const spec = specs.find((s) => s.id === `obstacle-${kind}`);
      expect(spec?.game).toBe("plane");
      expect(spec?.variants.map((v) => v.name)).toEqual([
        ...OBSTACLE_VARIANTS[kind],
      ]);
      expect(OBSTACLE_TYPICAL_SIZE[kind]).toHaveLength(3);
    }
  );

  it("colours every fixed slot a spec uses, and only the palette ones else", () => {
    const known = new Set(["soft", "hard", ...Object.keys(FIXED_SLOT_COLORS)]);
    for (const spec of specs.filter((s) => s.id.startsWith("obstacle-"))) {
      for (const slot of spec.slots) expect(known.has(slot)).toBe(true);
    }
  });

  it("picks a stable variant, mixing both on a level that has several", () => {
    const trees = LEVELS.jungle.obstacles.filter((o) => o.kind === "tree");
    const picks = trees.map(obstacleVariant);
    expect(trees.map(obstacleVariant)).toEqual(picks);
    expect(new Set(picks)).toEqual(new Set(OBSTACLE_VARIANTS.tree));
    const wall: Obstacle = LEVELS.canyon.obstacles.find(
      (o) => o.kind === "wall"
    ) as Obstacle;
    expect(obstacleVariant(wall)).toBe("wall");
  });
});

describe("obstacleGeometryFromScene", () => {
  function triangle(name: string, ao?: number): Mesh {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3)
    );
    geometry.setAttribute(
      "normal",
      new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3)
    );
    if (ao !== undefined) {
      geometry.setAttribute(
        "color",
        new BufferAttribute(new Float32Array(9).fill(ao), 3)
      );
    }
    const mesh = new Mesh(geometry, new MeshBasicMaterial());
    mesh.name = name;
    return mesh;
  }

  it("paints each slot from the palette or the fixed table, times its AO", () => {
    const scene = new Group();
    scene.add(triangle("soft", 0.5), triangle("trunk"));
    const { palette } = LEVELS.meadow;
    const geometry = obstacleGeometryFromScene(scene, palette, "test.glb");
    const color = geometry.getAttribute("color");
    expect(color.count).toBe(6);
    const soft = [color.getX(0), color.getY(0), color.getZ(0)];
    const trunk = [color.getX(3), color.getY(3), color.getZ(3)];
    // Two meshes, one geometry: the AO halves the palette's soft green.
    expect(soft[1] / trunk[1]).not.toBeCloseTo(0);
    expect(soft[1]).toBeLessThan(1);
    expect(trunk[0]).toBeGreaterThan(trunk[2]);
  });

  it("rejects a mesh that is not a known slot", () => {
    const scene = new Group();
    scene.add(triangle("mystery"));
    expect(() =>
      obstacleGeometryFromScene(scene, LEVELS.meadow.palette, "x.glb")
    ).toThrow(/Unknown slot/);
  });
});
