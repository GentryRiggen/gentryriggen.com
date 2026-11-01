import fs from "node:fs";
import path from "node:path";
import { newRun } from "../../../engine/engine";
import { def, runAtPhaseStart } from "./fixtures";

const ROOT = path.resolve(__dirname, "../../../../..");

function filesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : filesUnder(full);
    return [full];
  });
}

describe("Make It Grow guardrails", () => {
  it("imports nothing from lib/analytics", () => {
    const dirs = [
      "lib/ever-onward/universes/grow",
      "components/ever-onward/scenes/grow",
      "components/ever-onward/game/grow",
    ].map((d) => path.join(ROOT, d));
    const files = [
      ...dirs.flatMap(filesUnder),
      path.join(ROOT, "components/ever-onward/universes/grow.tsx"),
    ];
    expect(files.length).toBeGreaterThan(10);
    for (const f of files)
      expect(fs.readFileSync(f, "utf8")).not.toMatch(/analytics/);
  });

  it("counts no people", () =>
    expect(
      def.resources.filter((r) =>
        /people|population|resident|town/i.test(r.label + r.id)
      )
    ).toEqual([]));

  it("keeps every line gentle", () =>
    expect(
      def.story.filter((m) =>
        /\b(die|dead|death|kill|hurt|scared|blood)\b/i.test(m.text)
      )
    ).toEqual([]));

  it("ends the run in the last phase and nowhere else", () => {
    for (const i of [0, 1, 2]) expect(runAtPhaseStart(i).complete).toBe(false);
    expect(def.isComplete(newRun(def))).toBe(false);
    const early = runAtPhaseStart(2);
    expect(def.isComplete(early)).toBe(false);
  });
});
