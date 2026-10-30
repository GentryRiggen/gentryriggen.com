import type { Obstacle } from "@/lib/plane-builder/levels/types";
import { buildCloudPuffs, CLOUD_LAYOUTS } from "../cloudPuffs";

function cloud(x: number): Obstacle {
  return {
    kind: "cloud",
    hard: false,
    center: { x, y: 40, z: 5 },
    half: { x: 14, y: 7, z: 14 },
  } as Obstacle;
}

describe("cloud layouts", () => {
  it.each(["puff", "storm"] as const)(
    "%s has 12 to 24 puffs inside the unit box",
    (style) => {
      const layout = CLOUD_LAYOUTS[style];
      expect(layout.length).toBeGreaterThanOrEqual(12);
      expect(layout.length).toBeLessThanOrEqual(24);
      for (const p of layout) {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(p.z)).toBeLessThanOrEqual(0.5);
      }
    }
  );
});

describe("buildCloudPuffs", () => {
  it("makes one set of puffs per cloud, far ones first", () => {
    const result = buildCloudPuffs([cloud(100), cloud(300)], "puff");
    expect(result.count).toBe(CLOUD_LAYOUTS.puff.length * 2);
    const xs = Array.from(
      { length: result.count },
      (_, i) => result.positions[i * 3]
    );
    expect([...xs].sort((a, b) => b - a)).toEqual(xs);
  });

  it("keeps every puff centre within the cloud's box", () => {
    const result = buildCloudPuffs([cloud(100)], "storm");
    for (let i = 0; i < result.count; i += 1) {
      expect(Math.abs(result.positions[i * 3] - 100)).toBeLessThanOrEqual(28);
      expect(Math.abs(result.positions[i * 3 + 1] - 40)).toBeLessThanOrEqual(
        7.5
      );
    }
  });

  it("is repeatable", () => {
    const a = buildCloudPuffs([cloud(100)], "puff");
    const b = buildCloudPuffs([cloud(100)], "puff");
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
  });
});
