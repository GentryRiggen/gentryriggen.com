import { CHALLENGES_KEY } from "../../persist/challenges";
import { challengeProgress, recordChallengeBest } from "../progressStore";

beforeEach(() => {
  localStorage.clear();
  challengeProgress.resetMemory();
});

describe("challengeProgress", () => {
  it("saves a best and reads it back", () => {
    expect(recordChallengeBest("a", "outlast", 170)).toBe(true);
    expect(recordChallengeBest("a", "outlast", 100)).toBe(false);
    expect(JSON.parse(localStorage.getItem(CHALLENGES_KEY)!).designs).toEqual({
      a: { outlast: 170 },
    });
  });

  it("never writes over data from a newer build", () => {
    const newer = JSON.stringify({
      v: 99,
      designs: { a: { outlast: 170 } },
      futureField: true,
    });
    localStorage.setItem(CHALLENGES_KEY, newer);
    challengeProgress.resetMemory();
    expect(challengeProgress.get().designs).toEqual({});
    // This session still keeps its stars, in memory only.
    expect(recordChallengeBest("b", "evacuation", 50)).toBe(true);
    expect(challengeProgress.get().designs).toEqual({
      b: { evacuation: 50 },
    });
    expect(localStorage.getItem(CHALLENGES_KEY)).toBe(newer);
  });
});
