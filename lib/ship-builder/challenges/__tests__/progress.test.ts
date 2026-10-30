import { isValidNickname } from "@/lib/leaderboard/nickname";
import {
  nextStarAt,
  starsFor,
  CHALLENGES,
  type ChallengeId,
} from "../definitions";
import {
  EMPTY_PROGRESS,
  UNSAVED_KEY,
  adoptUnsaved,
  designKeyOf,
  dropDesign,
  overallBests,
  parseProgress,
  recordBest,
  starsOfDesign,
  totalStars,
} from "../progress";

describe("starsFor", () => {
  it.each<[ChallengeId, number, number]>([
    ["outlast", 59, 0],
    ["outlast", 60, 1],
    ["outlast", 159, 1],
    ["outlast", 160, 2],
    ["outlast", 1439, 2],
    ["outlast", 1440, 3],
    ["evacuation", 24, 0],
    ["evacuation", 25, 1],
    ["evacuation", 75, 2],
    ["evacuation", 99, 2],
    ["evacuation", 100, 3],
    ["shipshape", 0, 0],
    ["shipshape", 3, 3],
  ])("%s at %i earns %i stars", (id, value, stars) => {
    expect(starsFor(id, value)).toBe(stars);
  });

  it("asks for ever more at each star", () => {
    for (const { starAt } of CHALLENGES) {
      expect(starAt[0]).toBeLessThan(starAt[1]);
      expect(starAt[1]).toBeLessThan(starAt[2]);
    }
  });

  it("names the next target, and none at three stars", () => {
    expect(nextStarAt("outlast", 0)).toBe(60);
    expect(nextStarAt("outlast", 100)).toBe(160);
    expect(nextStarAt("outlast", 1440)).toBeNull();
  });
});

describe("progress", () => {
  it("keeps only the best value per design and challenge", () => {
    let progress = recordBest(EMPTY_PROGRESS, "a", "outlast", 100);
    const same = recordBest(progress, "a", "outlast", 80);
    expect(same).toBe(progress);
    progress = recordBest(progress, "a", "outlast", 170);
    expect(progress.designs.a.outlast).toBe(170);
    expect(starsOfDesign(progress, "a", "outlast")).toBe(2);
    expect(starsOfDesign(progress, "b", "outlast")).toBe(0);
  });

  it("counts stars across all designs", () => {
    let progress = recordBest(EMPTY_PROGRESS, "a", "outlast", 170);
    progress = recordBest(progress, "a", "evacuation", 100);
    progress = recordBest(progress, "b", "outlast", 60);
    expect(totalStars(progress)).toBe(2 + 3 + 1);
  });

  it("reports the best value per challenge over every design", () => {
    let progress = recordBest(EMPTY_PROGRESS, "a", "outlast", 170);
    progress = recordBest(progress, "b", "outlast", 90);
    progress = recordBest(progress, "b", "shipshape", 2);
    expect(overallBests(progress)).toEqual({ outlast: 170, shipshape: 2 });
  });

  it("moves unsaved stars to a saved ship, keeping the better values", () => {
    let progress = recordBest(EMPTY_PROGRESS, UNSAVED_KEY, "outlast", 170);
    progress = recordBest(progress, "ship-1", "outlast", 61);
    progress = recordBest(progress, UNSAVED_KEY, "evacuation", 50);
    const moved = adoptUnsaved(progress, "ship-1");
    expect(moved.designs[UNSAVED_KEY]).toBeUndefined();
    expect(moved.designs["ship-1"]).toEqual({ outlast: 170, evacuation: 50 });
    expect(adoptUnsaved(moved, "ship-2")).toBe(moved);
  });

  it("drops a design", () => {
    const progress = recordBest(EMPTY_PROGRESS, "a", "outlast", 170);
    expect(dropDesign(progress, "a").designs).toEqual({});
    expect(dropDesign(progress, "zzz")).toBe(progress);
  });

  it("keys an unsaved ship apart from saved ones", () => {
    expect(designKeyOf(null)).toBe(UNSAVED_KEY);
    expect(designKeyOf("ship-1")).toBe("ship-1");
  });
});

describe("parseProgress", () => {
  it("reads good data", () => {
    const parsed = parseProgress(
      {
        designs: { a: { outlast: 170, evacuation: 50.4 } },
        nickname: "Happy Otter 7",
      },
      isValidNickname
    );
    expect(parsed).toEqual({
      designs: { a: { outlast: 170, evacuation: 50 } },
      nickname: "Happy Otter 7",
    });
  });

  it("drops what it cannot trust", () => {
    const parsed = parseProgress(
      {
        designs: {
          a: { outlast: 99999, cheat: 5, evacuation: "x", shipshape: -4 },
          b: "nope",
          "": { outlast: 70 },
        },
        nickname: "<script>",
      },
      isValidNickname
    );
    expect(parsed).toEqual({
      designs: { a: { outlast: 1440, shipshape: 0 } },
      nickname: null,
    });
  });

  it("is not fooled by a __proto__ key", () => {
    const raw = JSON.parse('{"designs":{"__proto__":{"outlast":70}}}');
    const parsed = parseProgress(raw, isValidNickname);
    expect(Object.keys(parsed.designs)).toEqual([]);
    expect(({} as Record<string, unknown>).outlast).toBeUndefined();
  });

  it.each([null, 5, "x", [], undefined])("reads %p as empty", (raw) => {
    expect(parseProgress(raw, isValidNickname)).toEqual(EMPTY_PROGRESS);
  });
});
