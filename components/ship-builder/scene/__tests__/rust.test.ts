import { MeshStandardMaterial } from "three";
import type { SimState } from "@/lib/ship-builder/sim/types";
import { rustAmount, withRust } from "../rust";

function stateAt(time: number, landedAt?: number): SimState {
  return {
    time,
    events:
      landedAt === undefined
        ? []
        : [{ at: landedAt, kind: "touched-bottom", body: "ship" }],
  } as unknown as SimState;
}

describe("rustAmount", () => {
  it("is 0 with no state", () => {
    expect(rustAmount(null)).toBe(0);
  });
  it("is 0 before touching bottom", () => {
    expect(rustAmount(stateAt(30))).toBe(0);
  });
  it("eases in after landing", () => {
    expect(rustAmount(stateAt(10, 10))).toBe(0);
    const mid = rustAmount(stateAt(12, 10));
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(rustAmount(stateAt(14, 10))).toBe(1);
    expect(rustAmount(stateAt(20, 10))).toBe(1);
  });
});

describe("withRust", () => {
  it("patches once", () => {
    const m = new MeshStandardMaterial();
    withRust(m);
    const first = m.onBeforeCompile;
    withRust(m);
    expect(m.onBeforeCompile).toBe(first);
  });
});
