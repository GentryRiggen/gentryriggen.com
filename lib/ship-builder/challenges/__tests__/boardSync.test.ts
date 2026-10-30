import {
  createBoardSync,
  entryOf,
  MAX_STARS_PER_WRITE,
  SUBMIT_INTERVAL_MS,
} from "../boardSync";
import { EMPTY_PROGRESS, recordBest } from "../progress";

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
});

describe("createBoardSync", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function make(enabled = true) {
    const submit = jest.fn().mockResolvedValue(true);
    const sync = createBoardSync({
      enabled,
      getProgress: () => starred,
      ensureNickname: () => "Happy Otter 7",
      submit,
      now: () => Date.now(),
    });
    return { sync, submit };
  }

  it("does nothing when disabled", () => {
    const { sync, submit } = make(false);
    sync.request();
    jest.advanceTimersByTime(SUBMIT_INTERVAL_MS * 2);
    expect(submit).not.toHaveBeenCalled();
  });

  it("sends at once, then at most one write per interval", () => {
    const { sync, submit } = make();
    sync.request();
    expect(submit).toHaveBeenCalledTimes(1);
    sync.request();
    sync.request();
    expect(submit).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(SUBMIT_INTERVAL_MS);
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it("survives a failing submit", async () => {
    const submit = jest.fn().mockRejectedValue(new Error("offline"));
    const sync = createBoardSync({
      enabled: true,
      getProgress: () => starred,
      ensureNickname: () => "Happy Otter 7",
      submit,
    });
    sync.request();
    await Promise.resolve();
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("stop cancels the waiting write", () => {
    const { sync, submit } = make();
    sync.request();
    sync.request();
    sync.stop();
    jest.advanceTimersByTime(SUBMIT_INTERVAL_MS * 2);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  describe("a big gap in stars", () => {
    // 40 stars at once: more than one design's worth.
    let big = EMPTY_PROGRESS;
    for (let i = 0; i < 14; i++) {
      big = recordBest(big, `ship-${i}`, "outlast", 1440);
    }

    it("tries the whole total on the first write", async () => {
      const submit = jest.fn().mockResolvedValue(true);
      const sync = createBoardSync({
        enabled: true,
        getProgress: () => big,
        ensureNickname: () => "Happy Otter 7",
        submit,
      });
      sync.request();
      // The first write has no base, so it tries the whole total.
      await Promise.resolve();
      expect(submit.mock.calls[0][0].totalStars).toBe(42);
    });

    it("falls back to a small total after a refusal, then steps up", async () => {
      const submit = jest
        .fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true);
      const sync = createBoardSync({
        enabled: true,
        getProgress: () => big,
        ensureNickname: () => "Happy Otter 7",
        submit,
      });
      const totals = async () => {
        await jest.advanceTimersByTimeAsync(SUBMIT_INTERVAL_MS);
        return submit.mock.calls.map((c) => c[0].totalStars);
      };
      sync.request();
      await Promise.resolve();
      sync.request();
      expect(await totals()).toEqual([42, MAX_STARS_PER_WRITE]);
      expect(await totals()).toEqual([42, 9, 18]);
      expect(await totals()).toEqual([42, 9, 18, 27]);
      sync.stop();
    });
  });
});
