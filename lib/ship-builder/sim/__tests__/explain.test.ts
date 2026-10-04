import { explainTrial } from "../explain";
import { runTrial } from "../seaTrial";
import type { SimSea, SimShip } from "../types";

const DEG = Math.PI / 180;

function ship(stabilityRatio: number, listDegrees = 0): SimShip {
  return { stabilityRatio, listAngle: listDegrees * DEG, beam: 4 };
}

function summaryOf(s: SimShip, sea: SimSea) {
  return explainTrial(runTrial({ ship: s, sea }), s, sea);
}

describe("explainTrial", () => {
  it("cheers a steady, well-built ship", () => {
    const summary = summaryOf(ship(0.05), "calm");
    expect(summary.title).toBe("Steady as she goes!");
    expect(summary.tips).toEqual([]);
  });

  it("warns a steady top-heavy ship that rougher seas are riskier", () => {
    const summary = summaryOf(ship(0.22), "calm");
    expect(summary.title).toBe("Steady as she goes!");
    expect(summary.message).toMatch(/top-heavy/);
    expect(summary.tips.join(" ")).toMatch(/lower/);
  });

  it("says a hard roll that recovered was close", () => {
    const summary = summaryOf(ship(0.05), "stormy");
    expect(summary.title).toBe("That was close!");
    expect(summary.tips).toEqual([]);
  });

  it("explains a top-heavy capsize with concrete fixes", () => {
    const summary = summaryOf(ship(0.22), "stormy");
    expect(summary.title).toBe("She capsized!");
    const tips = summary.tips.join(" ");
    expect(tips).toMatch(/fewer levels on top/);
    expect(tips).toMatch(/wider/);
    expect(tips).toMatch(/calmer sea/);
  });

  it("names the side and the balance fix for a lopsided ship", () => {
    const summary = summaryOf(ship(0.05, -12), "stormy");
    expect(summary.title).toBe("She capsized!");
    expect(summary.message).toMatch(/port/);
    expect(summary.tips.join(" ")).toMatch(/Balance the weight/);
  });

  it("does not suggest a calmer sea when the sea was already calm", () => {
    const summary = summaryOf(ship(0.5, 0), "calm");
    expect(summary.tips.join(" ")).not.toMatch(/calmer sea/);
  });

  it("never mentions people", () => {
    const seas: SimSea[] = ["calm", "choppy", "stormy"];
    for (const ratio of [0.05, 0.22, 0.5]) {
      for (const list of [0, 12, -20]) {
        for (const sea of seas) {
          const s = summaryOf(ship(ratio, list), sea);
          const text = [s.title, s.message, ...s.tips].join(" ");
          expect(text).not.toMatch(
            /drown|die|dead|passenger|crew|people|sailor|kill/i
          );
        }
      }
    }
  });
});

describe("explainTrial for a stable ship that the list capsized", () => {
  it("blames the list, not top-heaviness", () => {
    let found = 0;
    for (let list = 7; list < 8; list += 0.1) {
      const s = ship(0.06, list);
      const state = runTrial({ ship: s, sea: "stormy" });
      if (state.outcome !== "capsized") continue;
      found += 1;
      const summary = explainTrial(state, s, "stormy");
      expect(summary.message).not.toMatch(/top-heavy/);
      expect(summary.message).toMatch(/starboard/);
    }
    expect(found).toBeGreaterThan(0);
  });

  it("gives every capsized reason sensible wording", () => {
    const s = ship(0.06);
    for (const reason of ["stable", "rough-sea", null] as const) {
      const state = {
        ...runTrial({ ship: ship(0.22), sea: "stormy" }),
        reason,
      };
      const summary = explainTrial(state, s, "stormy");
      expect(summary.message).not.toMatch(/top-heavy/);
      expect(summary.message).toMatch(/stormy sea/);
    }
  });
});
