import {
  COMBO_MAX_STEP,
  COMBO_RESET_MS,
  comboSemitones,
  nextCombo,
  type ComboState,
} from "../combo";

describe("combo", () => {
  it("climbs one step per quick tap and resets after idle", () => {
    let state: ComboState | null = null;
    const steps: number[] = [];
    for (const t of [0, 100, 250, 400]) {
      state = nextCombo(state, t);
      steps.push(state.step);
    }
    expect(steps).toEqual([0, 1, 2, 3]);
    expect(nextCombo(state, 400 + COMBO_RESET_MS + 1).step).toBe(0);
  });

  it("treats a clock that went backwards as a fresh combo", () => {
    expect(nextCombo({ step: 5, at: 1000 }, 500).step).toBe(0);
  });

  it("walks the pentatonic scale upward", () => {
    const pitches = [0, 1, 2, 3, 4, 5, 6].map(comboSemitones);
    expect(pitches).toEqual([0, 2, 4, 7, 9, 12, 14]);
  });

  it("never exceeds the cap and keeps varying past it", () => {
    const top = comboSemitones(COMBO_MAX_STEP);
    const beyond = Array.from({ length: 12 }, (_, i) =>
      comboSemitones(COMBO_MAX_STEP + 1 + i)
    );
    expect(Math.max(...beyond)).toBeLessThanOrEqual(top);
    expect(new Set(beyond).size).toBeGreaterThan(1);
  });

  it("is safe for negative or fractional steps", () => {
    expect(comboSemitones(-3)).toBe(0);
    expect(comboSemitones(1.7)).toBe(2);
  });
});
