import { POP_H, POP_W, gridFromLuminance } from "../population";
import { chooseEnding, createPlanetState, applyHit } from "../damage";
import { TOOLS, TOOL_ORDER } from "../tools";
import { UNLOCK_PATH, nextUnlock } from "../unlocks";

const grid = gridFromLuminance(new Array(POP_W * POP_H).fill(1), POP_W, POP_H);

describe("1.1 tools", () => {
  it("has a spec for each of 20 unique tools in the order", () => {
    expect(TOOL_ORDER).toHaveLength(20);
    expect(new Set(TOOL_ORDER).size).toBe(20);
    for (const id of TOOL_ORDER) expect(TOOLS[id].id).toBe(id);
    expect(Object.keys(TOOLS)).toHaveLength(20);
  });

  it("unlocks every non-free tool exactly once, ascending", () => {
    const toolEntries = UNLOCK_PATH.filter((e) => e.item.kind === "tool");
    for (const id of TOOL_ORDER) {
      if (id === "asteroid") continue;
      expect(toolEntries.filter((e) => e.item.id === id)).toHaveLength(1);
    }
    for (let i = 1; i < UNLOCK_PATH.length; i++) {
      expect(UNLOCK_PATH[i].at).toBeGreaterThan(UNLOCK_PATH[i - 1].at);
    }
    expect(UNLOCK_PATH.at(-1)?.at).toBe(20000);
    expect(nextUnlock(20000)).toBeNull();
  });

  it("gives the Mothership the saucer icon", () => {
    expect(TOOLS.mothership.icon).toBe("🛸");
    expect(TOOLS.mothership.cooldownMs).toBe(6000);
    expect(TOOLS.alienLaser.icon).toBe("🔫");
  });

  it("picks consumed when only consumed damage exists", () => {
    const s = createPlanetState("earth", grid);
    s.familyDamage.consumed = 5;
    expect(chooseEnding(s)).toBe("consumed");
    s.familyDamage.shatter = 5;
    expect(chooseEnding(s)).toBe("shatter");
  });

  it("ends a fresh planet shattered with the Mothership", () => {
    const s = createPlanetState("earth", grid);
    expect(applyHit(s, "mothership", 0.5, 0.5).ending).toBe("shatter");
  });
});
