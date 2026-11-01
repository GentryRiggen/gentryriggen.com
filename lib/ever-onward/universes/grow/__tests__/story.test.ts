import { simulate } from "../../../engine/sim";
import { growBots } from "../bots";
import { def } from "./fixtures";

describe("Grow yard story", () => {
  const yard = def.story.filter((m) => m.phase === "yard");

  it("has a healthy amount of yard text, with unique ids", () => {
    expect(yard.length).toBeGreaterThanOrEqual(10);
    const ids = def.story.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      yard.filter((m) => m.text.startsWith("NEWS:")).length
    ).toBeGreaterThan(0);
    for (const m of yard) expect(m.text.length).toBeLessThanOrEqual(320);
  });

  it("gives every yard visitor its line", () => {
    const visitors = (def.visitors ?? []).filter((v) => v.phase === "yard");
    expect(visitors.length).toBeGreaterThanOrEqual(1);
    for (const v of visitors)
      expect(def.story.some((m) => m.id === v.id)).toBe(true);
  });

  it("reaches every yard line in a realistic run", () => {
    const { finalRun } = simulate(def, {
      maxSeconds: 3600,
      step: 1,
      strategy: growBots().realistic,
      stopWhen: (run) => run.phase >= 1,
    });
    const missing = yard
      .map((m) => m.id)
      .filter((id) => !finalRun.story.includes(id));
    // The thirsty line is for a garden that ran dry; a barrel avoids it.
    expect(missing.filter((id) => id !== "yard-thirsty")).toEqual([]);
  });
});
