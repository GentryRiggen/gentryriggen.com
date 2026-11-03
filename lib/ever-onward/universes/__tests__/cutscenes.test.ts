import { narrationLines } from "../../narration/lines";
import { growUniverse } from "../grow";
import { higherUniverse } from "../higher";
import { lightUniverse } from "../light";
import { smileUniverse } from "../smile";

describe.each([
  ["light", lightUniverse],
  ["grow", growUniverse],
  ["higher", higherUniverse],
  ["smile", smileUniverse],
])("%s cutscenes", (id, def) => {
  it.each(def.phases.map((p, i) => [p.id, p, i] as const))(
    "%s plays a film: 5 to 12 shots, the robot in most of them, then 2 or 3 short tips",
    (_phaseId, phase, i) => {
      const shots = phase.cutscene ?? [];
      expect(shots.length).toBeGreaterThanOrEqual(5);
      expect(shots.length).toBeLessThanOrEqual(12);
      for (const shot of shots) {
        expect(shot.text.length).toBeGreaterThan(10);
        expect(shot.text.length).toBeLessThanOrEqual(220);
      }
      // The first shot with a picture sets the scene.
      expect(shots.find((s) => !s.card)?.showcase).toBeDefined();
      const withRobot = shots.filter((s) => s.robot).length;
      expect(withRobot).toBeGreaterThanOrEqual(Math.ceil(shots.length * 0.6));
      // A universe's first part opens on its title card.
      if (i === 0) expect(shots[0].card).toBe("title");
      const tips = phase.tips ?? [];
      expect(tips.length).toBeGreaterThanOrEqual(2);
      expect(tips.length).toBeLessThanOrEqual(3);
      for (const tip of tips) expect(tip.length).toBeLessThanOrEqual(110);
    }
  );

  it("is narrated shot by shot, and the closing card reads the goal and tips", () => {
    const lines = new Map(narrationLines().map((l) => [l.id, l.text]));
    for (const phase of def.phases) {
      const shots = phase.cutscene ?? [];
      shots.forEach((shot, n) => {
        expect(lines.get(`${id}/cut-${phase.id}-${n + 1}`)).toBe(shot.text);
      });
      const end = lines.get(`${id}/cut-${phase.id}-end`);
      expect(end).toContain(`Your goal: ${phase.goal}`);
      expect(end).toContain(phase.tips?.[0]);
    }
  });

  it("keeps the kind words", () => {
    for (const phase of def.phases) {
      const words = [
        ...(phase.cutscene ?? []).map((s) => s.text),
        ...(phase.tips ?? []),
      ].join(" ");
      expect(words).not.toMatch(/\b(lose|lost|fail|wrong|bad|die)\b/i);
    }
  });
});
