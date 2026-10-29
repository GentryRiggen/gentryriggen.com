import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readGlb } from "@/assets/glbFile";
import {
  BUOY_SLOTS,
  ENV_MODELS,
  ENV_MODEL_URLS,
  ICEBERG_SLOTS,
  ROCK_SLOTS,
  SHIP_SLOTS,
  envModelUrl,
} from "../envModels";
import { shapeAndTurn } from "../ObstacleMesh";

jest.mock("@react-three/drei", () => ({ useGLTF: { preload: jest.fn() } }));

const SLOTS = {
  iceberg: ICEBERG_SLOTS,
  rock: ROCK_SLOTS,
  buoy: BUOY_SLOTS,
  ship: SHIP_SLOTS,
} as const;

function publicFile(url: string): string {
  return join(process.cwd(), "public", url);
}

describe("sea-environment models", () => {
  it("points every variant at a committed file", () => {
    for (const url of ENV_MODEL_URLS) {
      expect(existsSync(publicFile(url))).toBe(true);
    }
  });

  describe.each(Object.entries(ENV_MODELS))(
    "%s",
    (name, { model, variants }) => {
      const spec = JSON.parse(
        readFileSync(
          join(process.cwd(), "assets", "parts", `${model}.json`),
          "utf8"
        )
      );

      it("uses exactly the variants its spec lists", () => {
        expect(variants).toEqual(
          spec.variants.map((v: { name: string }) => v.name)
        );
      });

      it.each(variants)("%s draws every slot its file holds", (variant) => {
        const gltf = readGlb(publicFile(envModelUrl(model, variant))).json;
        const known = Object.keys(SLOTS[name as keyof typeof SLOTS]);
        for (const mesh of gltf.meshes) {
          expect(known).toContain(mesh.name);
        }
      });
    }
  );

  it("keeps the berg's underwater bulk see-through", () => {
    expect(ICEBERG_SLOTS.under.opacity).toBe(0.7);
    expect(ICEBERG_SLOTS.top.opacity).toBeUndefined();
  });
});

describe("shapeAndTurn", () => {
  it("picks one of the shapes and leaves a turn between 0 and 1", () => {
    for (let i = 0; i < 200; i++) {
      const { shape, turn } = shapeAndTurn(`rock:${i}`, 3);
      expect(Number.isInteger(shape)).toBe(true);
      expect(shape).toBeGreaterThanOrEqual(0);
      expect(shape).toBeLessThan(3);
      expect(turn).toBeGreaterThanOrEqual(0);
      expect(turn).toBeLessThanOrEqual(1);
    }
  });

  it("gives neighbouring ids different shapes", () => {
    const seen = new Set(
      Array.from({ length: 6 }, (_, i) => shapeAndTurn(`test:${i}`, 3).shape)
    );
    expect(seen.size).toBeGreaterThan(1);
  });

  it("keeps the same shape for the same id and uses every shape", () => {
    expect(shapeAndTurn("obstacle:7", 3)).toEqual(
      shapeAndTurn("obstacle:7", 3)
    );
    const seen = new Set(
      Array.from({ length: 200 }, (_, i) => shapeAndTurn(`r:${i}`, 3).shape)
    );
    expect(seen.size).toBe(3);
  });
});
