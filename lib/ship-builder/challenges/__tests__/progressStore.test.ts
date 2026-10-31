import { CHALLENGES_KEY } from "../../persist/challenges";
import { totalStars } from "../progress";
import {
  applyShipSeason,
  challengeProgress,
  loadedChallengeNickname,
  recordChallengeBest,
  setChallengeNickname,
} from "../progressStore";

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

describe("applyShipSeason", () => {
  it("starts a newer season from zero, keeping all-time stars", () => {
    recordChallengeBest("a", "outlast", 1440);
    expect(applyShipSeason(2)).toBe(true);
    const progress = challengeProgress.get();
    expect(progress.season).toEqual({ number: 2, designs: {} });
    expect(totalStars(progress)).toBe(3);
    // Stored, so a reload stays in season 2.
    expect(JSON.parse(localStorage.getItem(CHALLENGES_KEY)!).season).toEqual({
      number: 2,
      designs: {},
    });
  });

  it("leaves the same or an older season alone", () => {
    applyShipSeason(3);
    recordChallengeBest("a", "outlast", 170);
    const before = challengeProgress.get();
    expect(applyShipSeason(3)).toBe(false);
    expect(applyShipSeason(2)).toBe(false);
    expect(challengeProgress.get()).toBe(before);
  });
});

describe("loadedChallengeNickname", () => {
  it("is the name the save loaded with, not one set since", () => {
    localStorage.setItem(
      CHALLENGES_KEY,
      JSON.stringify({ v: 3, designs: {}, nickname: "Happy Otter 7" })
    );
    challengeProgress.resetMemory();
    expect(challengeProgress.get().nickname).toBe("Happy Otter 7");
    setChallengeNickname("Brave Panda 3");
    expect(loadedChallengeNickname()).toBe("Happy Otter 7");
  });
});
