import { blowHorn, HORN_COOLDOWN_MS, resetHorn } from "../horn";
import { trialSynth } from "../synth";

jest.mock("../synth", () => ({
  trialSynth: { play: jest.fn(), canPlay: jest.fn(() => true) },
}));

beforeEach(() => {
  jest.clearAllMocks();
  (trialSynth.canPlay as jest.Mock).mockReturnValue(true);
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

  it("starts no cooldown when nothing would sound", () => {
    (trialSynth.canPlay as jest.Mock).mockReturnValue(false);
    expect(blowHorn(1000)).toBe(false);
    expect(trialSynth.play).not.toHaveBeenCalled();
    (trialSynth.canPlay as jest.Mock).mockReturnValue(true);
    expect(blowHorn(1001)).toBe(true);
  });
});
