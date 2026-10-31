import { banDeletePaths, nextSeasonNumber, parseAdminRow } from "../adminBoard";

describe("nextSeasonNumber", () => {
  it("starts season 2 when there is no season doc", () => {
    expect(nextSeasonNumber(undefined)).toBe(2);
  });

  it("adds one to the current number", () => {
    expect(nextSeasonNumber({ number: 2 })).toBe(3);
    expect(nextSeasonNumber({ number: 9 })).toBe(10);
  });

  it("refuses a malformed season doc", () => {
    expect(() => nextSeasonNumber({ number: "2" })).toThrow();
    expect(() => nextSeasonNumber({ number: 2.5 })).toThrow();
    expect(() => nextSeasonNumber({})).toThrow();
  });
});

describe("banDeletePaths", () => {
  it("covers every season of both games and the daily from two days ago to tomorrow", () => {
    expect(
      banDeletePaths("u1", 3, 1, new Date("2026-10-01T00:05:00Z"))
    ).toEqual([
      "leaderboard/u1",
      "planeSeasons/2/entries/u1",
      "planeSeasons/3/entries/u1",
      "shipLeaderboard/u1",
      "planeDaily/2026-10-02/entries/u1",
      "planeDaily/2026-10-01/entries/u1",
      "planeDaily/2026-09-30/entries/u1",
      "planeDaily/2026-09-29/entries/u1",
    ]);
  });
});

describe("parseAdminRow", () => {
  it("reads a plane row", () => {
    expect(
      parseAdminRow("plane", "u", {
        nickname: "Happy Fox 3",
        prestige: 2,
        lifetimeDistance: 10,
        score: 1,
        updatedAt: null,
      })
    ).toEqual({
      uid: "u",
      nickname: "Happy Fox 3",
      prestige: 2,
      lifetimeDistance: 10,
      updatedAt: null,
    });
  });

  it("reads a ship row", () => {
    const at = new Date();
    expect(
      parseAdminRow("ship", "u", {
        nickname: "Calm Seal 4",
        totalStars: 5,
        updatedAt: { toDate: () => at },
      })
    ).toEqual({
      uid: "u",
      nickname: "Calm Seal 4",
      totalStars: 5,
      updatedAt: at,
    });
  });

  it("skips malformed docs", () => {
    expect(parseAdminRow("plane", "u", { nickname: 3 })).toBeNull();
    expect(
      parseAdminRow("plane", "u", { nickname: "x", prestige: 1 })
    ).toBeNull();
    expect(
      parseAdminRow("ship", "u", { nickname: "x", totalStars: "5" })
    ).toBeNull();
  });
});
