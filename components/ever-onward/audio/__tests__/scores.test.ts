import { isValidSpec, planBar } from "../../../game-audio/music";
import { SCORES, scoreForPhase, uneaseForPhase } from "../scores";

describe("Ever Onward scores", () => {
  it.each(SCORES.map((s) => [s.id, s] as const))("%s is valid", (_id, spec) => {
    expect(isValidSpec(spec)).toBe(true);
    expect(planBar(spec, 0).length).toBeGreaterThan(0);
  });

  it("has unique ids and maps phases, clamping out of range", () => {
    expect(new Set(SCORES.map((s) => s.id)).size).toBe(SCORES.length);
    expect(scoreForPhase(0).id).toBe("eo-coast");
    expect(scoreForPhase(99).id).toBe("eo-last");
    expect(scoreForPhase(-1).id).toBe("eo-coast");
  });

  it("keeps the coast calm and the later phases subtly uneasy", () => {
    expect(uneaseForPhase(0)).toBeNull();
    expect(uneaseForPhase(1)).not.toBeNull();
    expect(uneaseForPhase(2)?.meanGapS).toBeGreaterThan(30);
  });
});
