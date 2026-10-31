import type { OwnShipEntry } from "@/lib/leaderboard/shipBoard";
import { starsFor, type ChallengeId } from "../definitions";
import {
  createBoardSync,
  fitBests,
  entryOf,
  firstWriteMax,
  MAX_STARS_PER_WRITE,
  SEASON_READ_MS,
  SUBMIT_INTERVAL_MS,
  type BoardSyncDeps,
} from "../boardSync";
import {
  EMPTY_PROGRESS,
  recordBest,
  startShipSeason,
  type ChallengeProgress,
} from "../progress";

const starred = recordBest(EMPTY_PROGRESS, "a", "outlast", 170);

describe("entryOf", () => {
  it("is null with no stars", () => {
    expect(entryOf(EMPTY_PROGRESS, "Happy Otter 7")).toBeNull();
    expect(
      entryOf(recordBest(EMPTY_PROGRESS, "a", "outlast", 10), "Happy Otter 7")
    ).toBeNull();
  });

  it("carries the total and the best values", () => {
    expect(entryOf(starred, "Happy Otter 7")).toEqual({
      nickname: "Happy Otter 7",
      totalStars: 2,
      bests: { outlast: 170 },
    });
  });

  it("uses season stars only", () => {
    // 40 all-time stars: 13 designs at three, one at one.
    let progress = EMPTY_PROGRESS;
    for (let i = 0; i < 13; i++) {
      progress = recordBest(progress, `ship-${i}`, "outlast", 1440);
    }
    progress = recordBest(progress, "ship-13", "outlast", 60);
    progress = startShipSeason(progress, 3);
    progress = recordBest(progress, "ship-0", "evacuation", 100);
    expect(entryOf(progress, "Happy Otter 7")).toEqual({
      nickname: "Happy Otter 7",
      totalStars: 3,
      bests: { evacuation: 100 },
    });
  });

  it("is null when the season has no stars yet", () => {
    expect(entryOf(startShipSeason(starred, 2), "Happy Otter 7")).toBeNull();
  });
});

describe("firstWriteMax", () => {
  it("allows 6 plus one star per 5 seconds since the season began, up to 60", () => {
    expect(firstWriteMax(0)).toBe(6);
    expect(firstWriteMax(-30)).toBe(6);
    expect(firstWriteMax(30)).toBe(12);
    expect(firstWriteMax(32)).toBe(12);
    expect(firstWriteMax(10_000)).toBe(60);
    expect(firstWriteMax(null)).toBe(60);
  });
});

const LONG_AGO = new Date(0);

/** A sync in season 2 (begun long ago) with the board entry unreadable. */
function makeSync(over: Partial<BoardSyncDeps> = {}) {
  let nickname: string | null = "Happy Otter 7";
  const submit = jest.fn().mockResolvedValue("ok");
  const readSeason = jest
    .fn()
    .mockResolvedValue({ number: 2, startedAt: LONG_AGO });
  const readOwnEntry = jest.fn().mockResolvedValue(null);
  const onSeason = jest.fn();
  const setNickname = jest.fn((name: string) => {
    nickname = name;
  });
  const deps: BoardSyncDeps = {
    enabled: true,
    getProgress: () => starred,
    ensureNickname: () => nickname ?? "Happy Otter 7",
    submit,
    readSeason,
    readOwnEntry,
    onSeason,
    loadedNickname: () => "Happy Otter 7",
    setNickname,
    now: () => Date.now(),
    ...over,
  };
  const sync = createBoardSync(deps);
  const totals = () =>
    (deps.submit as jest.Mock).mock.calls.map((c) => c[0].totalStars);
  return {
    sync,
    submit,
    readSeason,
    readOwnEntry,
    onSeason,
    setNickname,
    totals,
  };
}

describe("createBoardSync", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("does nothing when disabled", async () => {
    const { sync, submit, readSeason } = makeSync({ enabled: false });
    sync.start();
    sync.request();
    await jest.advanceTimersByTimeAsync(SUBMIT_INTERVAL_MS * 2);
    expect(submit).not.toHaveBeenCalled();
    expect(readSeason).not.toHaveBeenCalled();
  });

  it("sends at once, then at most one write per interval", async () => {
    const { sync, submit } = makeSync();
    sync.request();
    await jest.advanceTimersByTimeAsync(0);
    expect(submit).toHaveBeenCalledTimes(1);
    sync.request();
    sync.request();
    await jest.advanceTimersByTimeAsync(0);
    expect(submit).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(SUBMIT_INTERVAL_MS);
    expect(submit).toHaveBeenCalledTimes(2);
    sync.stop();
  });

  it("submit passes the season number", async () => {
    const { sync, submit } = makeSync();
    sync.request();
    await jest.advanceTimersByTimeAsync(0);
    expect(submit).toHaveBeenCalledWith(
      { nickname: "Happy Otter 7", totalStars: 2, bests: { outlast: 170 } },
      2
    );
  });

  it("survives a failing submit", async () => {
    const submit = jest.fn().mockRejectedValue(new Error("offline"));
    const { sync } = makeSync({ submit });
    sync.request();
    await jest.advanceTimersByTimeAsync(0);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("stop cancels the waiting write", async () => {
    const { sync, submit } = makeSync();
    sync.request();
    await jest.advanceTimersByTimeAsync(0);
    sync.request();
    sync.stop();
    await jest.advanceTimersByTimeAsync(SUBMIT_INTERVAL_MS * 2);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  describe("seasons", () => {
    it("no season read, no submit", async () => {
      const { sync, submit } = makeSync({
        readSeason: jest.fn().mockResolvedValue(null),
      });
      sync.request();
      await jest.advanceTimersByTimeAsync(SUBMIT_INTERVAL_MS * 3);
      expect(submit).not.toHaveBeenCalled();
    });

    it("never writes season 1, the frozen board", async () => {
      const { sync, submit, onSeason } = makeSync({
        readSeason: jest.fn().mockResolvedValue({ number: 1, startedAt: null }),
      });
      sync.request();
      await jest.advanceTimersByTimeAsync(0);
      expect(onSeason).toHaveBeenCalledWith(1);
      expect(submit).not.toHaveBeenCalled();
    });

    it("start reads the season and hands it on", async () => {
      const { sync, readSeason, onSeason, submit } = makeSync();
      sync.start();
      await jest.advanceTimersByTimeAsync(0);
      expect(readSeason).toHaveBeenCalledTimes(1);
      expect(onSeason).toHaveBeenCalledWith(2);
      expect(submit).not.toHaveBeenCalled();
      // A submit soon after uses that read.
      sync.request();
      await jest.advanceTimersByTimeAsync(0);
      expect(readSeason).toHaveBeenCalledTimes(1);
      expect(submit).toHaveBeenCalledTimes(1);
    });

    it("reads the season again once the last read is 10 minutes old", async () => {
      const { sync, readSeason } = makeSync();
      sync.request();
      await jest.advanceTimersByTimeAsync(SUBMIT_INTERVAL_MS);
      sync.request();
      await jest.advanceTimersByTimeAsync(0);
      expect(readSeason).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(SEASON_READ_MS);
      sync.request();
      await jest.advanceTimersByTimeAsync(0);
      expect(readSeason).toHaveBeenCalledTimes(2);
    });

    it("newer season resets accepted/refusals climb state", async () => {
      let big: ChallengeProgress = EMPTY_PROGRESS;
      for (let i = 0; i < 14; i++) {
        big = recordBest(big, `ship-${i}`, "outlast", 1440);
      }
      const readSeason = jest
        .fn()
        .mockResolvedValueOnce({ number: 2, startedAt: LONG_AGO })
        .mockResolvedValueOnce({ number: 2, startedAt: LONG_AGO })
        .mockResolvedValue({ number: 3, startedAt: LONG_AGO });
      const submit = jest
        .fn()
        .mockResolvedValueOnce("refused")
        .mockResolvedValueOnce("refused")
        .mockResolvedValue("ok");
      const { sync, totals, onSeason } = makeSync({
        getProgress: () => big,
        readSeason,
        submit,
      });
      sync.request();
      await jest.advanceTimersByTimeAsync(SUBMIT_INTERVAL_MS * 2);
      // Two refusals in season 2 would step down to 9; season 3 starts over.
      expect(totals()).toEqual([42, 42, 42]);
      expect(submit.mock.calls.map((c) => c[1])).toEqual([2, 2, 3]);
      expect(onSeason).toHaveBeenLastCalledWith(3);
      sync.stop();
    });

    it("caps the first write by the time since the season began", async () => {
      let big: ChallengeProgress = EMPTY_PROGRESS;
      for (let i = 0; i < 14; i++) {
        big = recordBest(big, `ship-${i}`, "outlast", 1440);
      }
      const { sync, totals } = makeSync({
        getProgress: () => big,
        readSeason: jest.fn().mockResolvedValue({
          number: 2,
          startedAt: new Date(Date.now() - 30_000),
        }),
        readOwnEntry: jest.fn().mockResolvedValue("missing"),
      });
      sync.request();
      await jest.advanceTimersByTimeAsync(0);
      // 6 + 30 / 5.
      expect(totals()).toEqual([12]);
      sync.stop();
    });

    it("caps a first write at 60 long after the season began", async () => {
      let huge: ChallengeProgress = EMPTY_PROGRESS;
      for (let i = 0; i < 30; i++) {
        huge = recordBest(huge, `ship-${i}`, "outlast", 1440);
      }
      const { sync, totals } = makeSync({
        getProgress: () => huge,
        readOwnEntry: jest.fn().mockResolvedValue("missing"),
      });
      sync.request();
      await jest.advanceTimersByTimeAsync(0);
      expect(totals()).toEqual([60]);
      sync.stop();
    });

    it("climbs from the board's total when the entry is read", async () => {
      let big: ChallengeProgress = EMPTY_PROGRESS;
      for (let i = 0; i < 14; i++) {
        big = recordBest(big, `ship-${i}`, "outlast", 1440);
      }
      const own: OwnShipEntry = {
        nickname: "Happy Otter 7",
        totalStars: 20,
        updatedAt: 0,
      };
      const { sync, totals } = makeSync({
        getProgress: () => big,
        readOwnEntry: jest.fn().mockResolvedValue(own),
      });
      sync.request();
      await jest.advanceTimersByTimeAsync(0);
      expect(totals()).toEqual([20 + MAX_STARS_PER_WRITE]);
      sync.stop();
    });
  });

  describe("names", () => {
    const own = (nickname: string): OwnShipEntry => ({
      nickname,
      totalStars: 2,
      updatedAt: 0,
    });

    it("adopts a name the admin set", async () => {
      const { sync, submit, setNickname } = makeSync({
        readOwnEntry: jest.fn().mockResolvedValue(own("Brave Panda 3")),
      });
      sync.request();
      await jest.advanceTimersByTimeAsync(0);
      expect(setNickname).toHaveBeenCalledWith("Brave Panda 3");
      expect(submit.mock.calls[0][0].nickname).toBe("Brave Panda 3");
    });

    it("keeps a name changed since the save loaded", async () => {
      const { sync, submit, setNickname } = makeSync({
        loadedNickname: () => "Brave Panda 3",
        readOwnEntry: jest.fn().mockResolvedValue(own("Brave Panda 3")),
      });
      sync.request();
      await jest.advanceTimersByTimeAsync(0);
      expect(setNickname).not.toHaveBeenCalled();
      expect(submit.mock.calls[0][0].nickname).toBe("Happy Otter 7");
    });

    it("keeps its own name once sent, until the board changes it", async () => {
      const readOwnEntry = jest.fn().mockResolvedValue(null);
      const { sync, setNickname } = makeSync({ readOwnEntry });
      sync.request();
      await jest.advanceTimersByTimeAsync(0);
      // Sent "Happy Otter 7"; the board still shows it: nothing to adopt.
      readOwnEntry.mockResolvedValue(own("Happy Otter 7"));
      await jest.advanceTimersByTimeAsync(SUBMIT_INTERVAL_MS);
      sync.request();
      await jest.advanceTimersByTimeAsync(0);
      expect(setNickname).not.toHaveBeenCalled();
      sync.stop();
    });
  });

  describe("a big gap in stars", () => {
    // 40 stars at once: more than one design's worth.
    let big = EMPTY_PROGRESS;
    for (let i = 0; i < 14; i++) {
      big = recordBest(big, `ship-${i}`, "outlast", 1440);
    }

    it("tries the whole total on the first write", async () => {
      const { sync, submit } = makeSync({ getProgress: () => big });
      sync.request();
      // The first write has no base, so it tries the whole total.
      await jest.advanceTimersByTimeAsync(0);
      expect(submit.mock.calls[0][0].totalStars).toBe(42);
      sync.stop();
    });

    function makeBig(submit: jest.Mock) {
      return makeSync({ getProgress: () => big, submit });
    }

    it("retries the full total after one refusal (a rate limit)", async () => {
      const submit = jest
        .fn()
        .mockResolvedValueOnce("refused")
        .mockResolvedValue("ok");
      const { sync, totals } = makeBig(submit);
      sync.request();
      await jest.advanceTimersByTimeAsync(SUBMIT_INTERVAL_MS);
      expect(totals()).toEqual([42, 42]);
      sync.stop();
    });

    it("retries the full total after any number of network errors", async () => {
      const submit = jest
        .fn()
        .mockResolvedValueOnce("error")
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce("error")
        .mockResolvedValue("ok");
      const { sync, totals } = makeBig(submit);
      for (let i = 0; i < 4; i++) {
        sync.request();
        await jest.advanceTimersByTimeAsync(SUBMIT_INTERVAL_MS);
      }
      expect(totals()).toEqual([42, 42, 42, 42]);
      sync.stop();
    });

    it("steps up only after the full total was refused twice", async () => {
      const submit = jest
        .fn()
        .mockResolvedValueOnce("refused")
        .mockResolvedValueOnce("refused")
        .mockResolvedValue("ok");
      const { sync, totals } = makeBig(submit);
      sync.request();
      await jest.advanceTimersByTimeAsync(SUBMIT_INTERVAL_MS * 6);
      expect(totals()).toEqual([42, 42, MAX_STARS_PER_WRITE, 18, 27, 36, 42]);
      sync.stop();
    });

    it("gives up retrying a refusal that keeps coming", async () => {
      const submit = jest.fn().mockResolvedValue("refused");
      const { sync } = makeBig(submit);
      sync.request();
      await jest.advanceTimersByTimeAsync(SUBMIT_INTERVAL_MS * 10);
      expect(submit.mock.calls.length).toBeLessThanOrEqual(4);
      sync.stop();
    });
  });

  describe("bests worth more than one write may carry", () => {
    // One design with every challenge at three stars: the bests alone are
    // worth 12, more than the 9 a fallback write steps to.
    let rich = EMPTY_PROGRESS;
    for (const [id, value] of [
      ["outlast", 1440],
      ["evacuation", 100],
      ["shipshape", 3],
      ["smooth", 350],
    ] as const) {
      rich = recordBest(rich, "a", id, value);
    }

    /** What the rules check: bests present, and the total covers them. */
    function isValidWrite(entry: {
      totalStars: number;
      bests: Readonly<Record<string, number | undefined>>;
    }) {
      const ids = Object.keys(entry.bests);
      const worth = ids.reduce(
        (sum, id) =>
          sum + starsFor(id as ChallengeId, entry.bests[id] as number),
        0
      );
      return ids.length > 0 && entry.totalStars >= worth;
    }

    it("never sends a total below what its bests are worth", async () => {
      // 14 more designs push the target high, so the climb has to step.
      let progress = rich;
      for (let i = 0; i < 14; i++) {
        progress = recordBest(progress, `ship-${i}`, "outlast", 1440);
      }
      const submit = jest
        .fn()
        .mockResolvedValueOnce("refused")
        .mockResolvedValueOnce("refused")
        .mockResolvedValue("ok");
      const { sync } = makeSync({ getProgress: () => progress, submit });
      sync.request();
      await jest.advanceTimersByTimeAsync(SUBMIT_INTERVAL_MS * 10);
      const writes = submit.mock.calls.map((c) => c[0]);
      expect(writes.length).toBeGreaterThan(4);
      for (const write of writes) expect(isValidWrite(write)).toBe(true);
      // The fallback is the first stepped write: 9 stars, bests cut to fit.
      expect(writes[2].totalStars).toBe(MAX_STARS_PER_WRITE);
      expect(Object.keys(writes[2].bests).length).toBeLessThan(4);
      // The climb ends with the full total and every best.
      const last = writes[writes.length - 1];
      expect(last.totalStars).toBe(54);
      expect(Object.keys(last.bests)).toHaveLength(4);
      sync.stop();
    });

    it("cuts the bests when a step from a known base is below them", async () => {
      const submit = jest.fn().mockResolvedValue("ok");
      let progress = recordBest(EMPTY_PROGRESS, "x", "outlast", 1440);
      const { sync } = makeSync({ getProgress: () => progress, submit });
      sync.request();
      await jest.advanceTimersByTimeAsync(0);
      // The player then earns a lot offline: a new design worth 12.
      for (const [id, value] of [
        ["outlast", 1440],
        ["evacuation", 100],
        ["shipshape", 3],
        ["smooth", 350],
      ] as const) {
        progress = recordBest(progress, "b", id, value);
      }
      sync.request();
      await jest.advanceTimersByTimeAsync(SUBMIT_INTERVAL_MS * 3);
      for (const [entry] of submit.mock.calls) {
        expect(isValidWrite(entry)).toBe(true);
      }
      expect(submit.mock.calls.at(-1)![0].totalStars).toBe(15);
      sync.stop();
    });

    it("keeps the most valuable bests that fit", () => {
      expect(
        fitBests({ outlast: 1440, evacuation: 100, shipshape: 1 }, 6)
      ).toEqual({ outlast: 1440, evacuation: 100 });
      expect(fitBests({ outlast: 1440, smooth: 100 }, 3)).toEqual({
        outlast: 1440,
      });
      expect(fitBests({ outlast: 1440 }, 9)).toEqual({ outlast: 1440 });
    });
  });
});
