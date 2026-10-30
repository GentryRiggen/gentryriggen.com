import { blowHorn, HORN_COOLDOWN_MS, resetHorn } from "../horn";
import { trialSynth } from "../synth";

jest.mock("../synth", () => ({
  trialSynth: { play: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  resetHorn();
});

describe("blowHorn", () => {
  it("sounds the horn", () => {
    expect(blowHorn(1000)).toBe(true);
    expect(trialSynth.play).toHaveBeenCalledWith({ kind: "horn" });
  });

  it("ignores a press while the horn is still sounding", () => {
    blowHorn(1000);
    expect(blowHorn(1000 + HORN_COOLDOWN_MS - 1)).toBe(false);
    expect(trialSynth.play).toHaveBeenCalledTimes(1);
  });

  it("sounds again once it has finished", () => {
    blowHorn(1000);
    expect(blowHorn(1000 + HORN_COOLDOWN_MS)).toBe(true);
    expect(trialSynth.play).toHaveBeenCalledTimes(2);
  });
});
