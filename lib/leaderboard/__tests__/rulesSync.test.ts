import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LEVELS, LEVEL_ORDER } from "@/lib/plane-builder/levels";
import { MAX_SPEED } from "@/lib/plane-builder/sim/constants";
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
});
