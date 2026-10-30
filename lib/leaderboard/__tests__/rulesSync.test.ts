import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LEVELS, LEVEL_ORDER } from "@/lib/plane-builder/levels";
import { MAX_SPEED } from "@/lib/plane-builder/sim/constants";
import { DAILY_PLAN } from "@/lib/plane-builder/daily/daily";
import { ADJECTIVES, ANIMALS } from "../nickname";

const rules = readFileSync(join(process.cwd(), "firestore.rules"), "utf8");

function listIn(name: string): string[] {
  const match = rules.match(new RegExp(`let ${name} = \\[([^\\]]*)\\];`));
  if (!match) throw new Error(`no ${name} list in firestore.rules`);
  return [...match[1].matchAll(/'([^']*)'/g)].map((m) => m[1]);
}

describe("firestore.rules stays in sync with the code", () => {
  it("has the same adjectives and animals as nickname.ts", () => {
    expect(listIn("adjectives")).toEqual([...ADJECTIVES]);
    expect(listIn("animals")).toEqual([...ANIMALS]);
  });

  it("has floor(finishDistance / MAX_SPEED) as every world's minimum time", () => {
    const minimums = new Map(
      [...rules.matchAll(/validTime\(t, '(\w+)', (\d+)\)/g)].map((m) => [
        m[1],
        Number(m[2]),
      ])
    );
    expect([...minimums.keys()].sort()).toEqual([...LEVEL_ORDER].sort());
    for (const id of LEVEL_ORDER) {
      expect(minimums.get(id)).toBe(
        Math.floor(LEVELS[id].finishDistance / MAX_SPEED)
      );
    }
  });

  it("allows exactly the world ids as bestTimes keys", () => {
    const match = rules.match(/t\.keys\(\)\.hasOnly\(\[([^\]]*)\]\)/);
    const keys = [...(match?.[1] ?? "").matchAll(/'(\w+)'/g)].map((m) => m[1]);
    expect(keys).toEqual([...LEVEL_ORDER]);
  });

  it("uses the sum of every finishDistance as the full-run distance", () => {
    const total = LEVEL_ORDER.reduce(
      (sum, id) => sum + LEVELS[id].finishDistance,
      0
    );
    // The rules use it in the prestige check and the fastestRun coherence.
    expect([...rules.matchAll(/68800/g)].length).toBeGreaterThanOrEqual(3);
    expect(total).toBe(68800);
  });

  it("requires every world id in a fastestRun's bestTimes", () => {
    const match = rules.match(/d\.bestTimes\.keys\(\)\.hasAll\(\[([^\]]*)\]\)/);
    const keys = [...(match?.[1] ?? "").matchAll(/'(\w+)'/g)].map((m) => m[1]);
    expect(keys).toEqual([...LEVEL_ORDER]);
  });

  it("has the same daily minimum times and world list as the best times", () => {
    const body = rules.match(/function dailyMinimum\(world\) \{([^}]*)\}/);
    const minimums = new Map(
      [...(body?.[1] ?? "").matchAll(/'(\w+)': (\d+)/g)].map((m) => [
        m[1],
        Number(m[2]),
      ])
    );
    expect([...minimums.keys()]).toEqual([...LEVEL_ORDER]);
    for (const id of LEVEL_ORDER) {
      expect(minimums.get(id)).toBe(
        Math.floor(LEVELS[id].finishDistance / MAX_SPEED)
      );
    }
  });

  it("has the same daily plan as the client, indexed by the path date", () => {
    const body = rules.match(
      /function dailyPlan\(\) \{\s*return \[([^\]]*)\];/
    );
    const plan = [...(body?.[1] ?? "").matchAll(/'([^']*)'/g)].map((m) => m[1]);
    expect(plan).toEqual([...DAILY_PLAN]);
    expect(plan).toHaveLength(40);
    expect(rules).toContain("dailyPlan()[day % 40]");
    expect(rules).toContain("86400000");
  });
});
