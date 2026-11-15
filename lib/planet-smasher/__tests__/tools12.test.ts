import { POP_H, POP_W, gridFromLuminance } from "../population";
import { applyHit, createPlanetState } from "../damage";
import { TOOLS, TOOL_ORDER } from "../tools";
import { UNLOCK_PATH, nextUnlock } from "../unlocks";

const grid = gridFromLuminance(new Array(POP_W * POP_H).fill(1), POP_W, POP_H);

describe("1.2 tools", () => {
  it("has 20 unique tools", () => {
    expect(TOOL_ORDER).toHaveLength(20);
    expect(new Set(TOOL_ORDER).size).toBe(20);
    expect(TOOL_ORDER.slice(-4)).toEqual([
      "monster",
      "tsunami",
      "sunDive",
      "planetCollision",
    ]);
  });

  it("unlocks each non-free tool once, strictly ascending", () => {
    const entries = UNLOCK_PATH.filter((e) => e.item.kind === "tool");
    for (const id of TOOL_ORDER) {
      if (id === "asteroid") continue;
      expect(entries.filter((e) => e.item.id === id)).toHaveLength(1);
    }
    for (let i = 1; i < UNLOCK_PATH.length; i++) {
      expect(UNLOCK_PATH[i].at).toBeGreaterThan(UNLOCK_PATH[i - 1].at);
    }
    expect(nextUnlock(109000)).toBeNull();
    expect(nextUnlock(97000)?.at).toBe(109000);
  });

  it("sunDive vaporizes and planetCollision collides", () => {
    const a = createPlanetState("earth", grid);
    expect(applyHit(a, "sunDive", 0.5, 0.5).ending).toBe("vaporized");
    const b = createPlanetState("earth", grid);
    expect(applyHit(b, "planetCollision", 0.5, 0.5).ending).toBe("collided");
  });

  it("uses the spec values", () => {
    expect(TOOLS.monster.cooldownMs).toBe(7000);
    expect(TOOLS.tsunami.stamp).toBe("flood");
    expect(TOOLS.sunDive.stamp).toBe("scorch");
  });
});
