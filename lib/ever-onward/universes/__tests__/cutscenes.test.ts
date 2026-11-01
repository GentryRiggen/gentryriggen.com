import { narrationLines } from "../../narration/lines";
import { growUniverse } from "../grow";
import { lightUniverse } from "../light";

describe.each([
  ["light", lightUniverse],
  ["grow", growUniverse],
])("%s cutscenes", (id, def) => {
  it.each(def.phases.map((p) => [p.id, p] as const))(
    "%s has four frames, with 2 to 3 short tips on frame 3",
    (_phaseId, phase) => {
      const frames = phase.cutscene ?? [];
      expect(frames).toHaveLength(4);
      for (const frame of frames) expect(frame.text.length).toBeGreaterThan(10);
      expect(frames[0].showcase).toBeDefined();
      const tips = frames[2].tips ?? [];
      expect(tips.length).toBeGreaterThanOrEqual(2);
      expect(tips.length).toBeLessThanOrEqual(3);
      for (const tip of tips) expect(tip.length).toBeLessThanOrEqual(110);
      expect(frames[0].tips).toBeUndefined();
      expect(frames[3].tips).toBeUndefined();
    }
  );

  it("is narrated frame by frame, and the goal is read on the last one", () => {
    const lines = new Map(narrationLines().map((l) => [l.id, l.text]));
    for (const phase of def.phases) {
      for (let n = 1; n <= 4; n += 1) {
        expect(lines.has(`${id}/cut-${phase.id}-${n}`)).toBe(true);
      }
      expect(lines.get(`${id}/cut-${phase.id}-3`)).toContain(
        phase.cutscene?.[2].tips?.[0]
      );
      expect(lines.get(`${id}/cut-${phase.id}-4`)).toContain(
        `Your goal: ${phase.goal}`
      );
    }
  });

  it("keeps the kind words", () => {
    for (const phase of def.phases) {
      for (const frame of phase.cutscene ?? []) {
        const words = [frame.text, ...(frame.tips ?? [])].join(" ");
        expect(words).not.toMatch(/\b(lose|lost|fail|wrong|bad|die)\b/i);
      }
    }
  });
});
