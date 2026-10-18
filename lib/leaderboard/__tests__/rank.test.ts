import { standingOn } from "../rank";
import type { LeaderboardRow } from "../types";

const row = (uid: string, value: number): LeaderboardRow => ({
  uid,
  nickname: `Name ${uid}`,
  value,
});

describe("standingOn", () => {
  it("ranks a new score on a descending board", () => {
    const rows = [row("a", 300), row("b", 200), row("c", 100)];
    const standing = standingOn(rows, "me", 150, "desc");
    expect(standing).toEqual({
      kind: "ranked",
      rank: 3,
      rival: rows[1],
      gap: 50,
      passed: [],
    });
  });

  it("ranks times on an ascending board", () => {
    const rows = [row("a", 10), row("b", 20), row("c", 30)];
    const standing = standingOn(rows, "me", 25, "asc");
    expect(standing).toMatchObject({ rank: 3, rival: rows[1], gap: 5 });
  });

  it("is #1 with no rival when ahead of everyone", () => {
    const standing = standingOn([row("a", 10)], "me", 5, "asc");
    expect(standing).toMatchObject({ rank: 1, rival: null, gap: null });
  });

  it("gives ties to the player", () => {
    const standing = standingOn([row("a", 10)], "me", 10, "asc");
    expect(standing).toMatchObject({ rank: 1, rival: null });
  });

  it("replaces the stored row and reports who was passed", () => {
    const rows = [row("a", 10), row("b", 20), row("c", 30), row("me", 40)];
    const standing = standingOn(rows, "me", 15, "asc");
    expect(standing).toEqual({
      kind: "ranked",
      rank: 2,
      rival: rows[0],
      gap: 5,
      passed: [rows[1], rows[2]],
    });
  });

  it("passes no one when the score did not improve", () => {
    const rows = [row("a", 10), row("me", 20)];
    expect(standingOn(rows, "me", 20, "asc")).toMatchObject({
      rank: 2,
      passed: [],
    });
  });

  it("is off the board behind a full board, with the gap to the cutoff", () => {
    const rows = [row("a", 300), row("b", 200), row("c", 100)];
    expect(standingOn(rows, "me", 40, "desc", 3)).toEqual({
      kind: "offBoard",
      cutoff: rows[2],
      gap: 60,
    });
  });

  it("still ranks a player whose own row fills the board", () => {
    const rows = [row("a", 300), row("b", 200), row("me", 100)];
    expect(standingOn(rows, "me", 150, "desc", 3)).toMatchObject({
      kind: "ranked",
      rank: 3,
    });
  });
});
