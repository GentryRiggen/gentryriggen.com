import { recordBest, EMPTY_PROGRESS } from "../../challenges/progress";
import {
  CHALLENGES_KEY,
  CHALLENGES_VERSION,
  isNewerChallengesFormat,
  parseChallenges,
  serializeChallenges,
} from "../challenges";
import { AUTOSAVE_KEY, SHIPS_KEY, loadAutosave, listShips } from "../local";

describe("challenge persistence", () => {
  beforeEach(() => window.localStorage.clear());

  it("round-trips progress", () => {
    const progress = {
      ...recordBest(EMPTY_PROGRESS, "ship-1", "outlast", 170),
      nickname: "Happy Otter 7",
    };
    const text = serializeChallenges(progress);
    expect(JSON.parse(text!).v).toBe(CHALLENGES_VERSION);
    expect(parseChallenges(text)).toEqual(progress);
  });

  it("stores nothing for empty progress", () => {
    expect(serializeChallenges(EMPTY_PROGRESS)).toBeNull();
  });

  it.each([null, "", "not json", "[]", "5", '{"designs":7}'])(
    "reads %p as no progress",
    (raw) => {
      expect(parseChallenges(raw)).toEqual(EMPTY_PROGRESS);
    }
  );

  it("reads a newer format as empty and recognises it", () => {
    const newer = JSON.stringify({
      v: CHALLENGES_VERSION + 1,
      designs: { a: { outlast: 170 } },
      nickname: null,
    });
    expect(isNewerChallengesFormat(newer)).toBe(true);
    expect(parseChallenges(newer)).toEqual(EMPTY_PROGRESS);
    expect(isNewerChallengesFormat(`{"v":${CHALLENGES_VERSION}}`)).toBe(false);
    expect(isNewerChallengesFormat("junk")).toBe(false);
  });

  it("still reads progress saved before the Smooth sailing id (v1)", () => {
    const v1 = JSON.stringify({
      v: 1,
      designs: { a: { outlast: 170 } },
      nickname: null,
    });
    expect(isNewerChallengesFormat(v1)).toBe(false);
    expect(parseChallenges(v1).designs).toEqual({ a: { outlast: 170 } });
  });

  it("reads a save from before seasons (v2) as season 0", () => {
    const v2 = JSON.stringify({
      v: 2,
      designs: { a: { outlast: 170 } },
      nickname: "Happy Otter 7",
    });
    expect(CHALLENGES_VERSION).toBe(3);
    const parsed = parseChallenges(v2);
    expect(parsed.designs).toEqual({ a: { outlast: 170 } });
    expect(parsed.season).toEqual({ number: 0, designs: {} });
  });

  it("round-trips the season and its stars", () => {
    const progress = recordBest(
      { ...EMPTY_PROGRESS, season: { number: 2, designs: {} } },
      "a",
      "outlast",
      170
    );
    const text = serializeChallenges(progress);
    expect(parseChallenges(text)).toEqual(progress);
  });

  it("stores a season number even with no stars yet", () => {
    const text = serializeChallenges({
      ...EMPTY_PROGRESS,
      season: { number: 2, designs: {} },
    });
    expect(parseChallenges(text).season.number).toBe(2);
  });

  it("lives apart from ship saves, which still load without it", () => {
    expect(CHALLENGES_KEY).not.toBe(SHIPS_KEY);
    expect(CHALLENGES_KEY).not.toBe(AUTOSAVE_KEY);
    expect(loadAutosave()).toEqual({ kind: "none" });
    expect(listShips()).toEqual([]);
  });
});
