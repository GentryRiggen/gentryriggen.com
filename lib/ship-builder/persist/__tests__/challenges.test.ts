import { recordBest, EMPTY_PROGRESS } from "../../challenges/progress";
import {
  CHALLENGES_KEY,
  CHALLENGES_VERSION,
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

  it("lives apart from ship saves, which still load without it", () => {
    expect(CHALLENGES_KEY).not.toBe(SHIPS_KEY);
    expect(CHALLENGES_KEY).not.toBe(AUTOSAVE_KEY);
    expect(loadAutosave()).toEqual({ kind: "none" });
    expect(listShips()).toEqual([]);
  });
});
