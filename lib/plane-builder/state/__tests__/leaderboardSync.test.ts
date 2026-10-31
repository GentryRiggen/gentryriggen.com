import type { CommitResult, OwnEntry } from "@/lib/leaderboard/client";
import { isValidNickname } from "@/lib/leaderboard/nickname";
import { scoreFor, type LeaderboardEntry } from "@/lib/leaderboard/types";
import { LEVEL_ORDER } from "../../levels";
import {
  newProgress,
  seasonEntry,
  type PlaneSeason,
} from "../../economy/progress";
import {
  CREATE_MAX_DISTANCE,
  RUN_DISTANCE,
  SEASON_READ_MS,
  SUBMIT_INTERVAL_MS,
  createLeaderboardSync,
  type LeaderboardSyncDeps,
} from "../leaderboardSync";
import { usePlaneBuilderStore } from "../store";

jest.mock("@/lib/leaderboard/client", () => ({
  submitEntryResult: jest.fn(),
  fetchOwnEntry: jest.fn(),
}));
jest.mock("@/lib/leaderboard/boardSettings", () => ({
  fetchBoardHidden: jest.fn().mockResolvedValue(true),
}));
jest.mock("@/lib/leaderboard/season", () => ({
  ...jest.requireActual("@/lib/leaderboard/season"),
  fetchSeason: jest.fn(),
}));

const flight = () => ({ result: {}, payout: {}, seen: false }) as never;

const season = (over: Partial<PlaneSeason> = {}): PlaneSeason => ({
  number: 2,
  prestiges: 0,
  distance: 1500,
  bestTimes: {},
  fastestRun: null,
  runCounts: true,
  ...over,
});

beforeEach(() => {
  jest.useFakeTimers();
  usePlaneBuilderStore.setState(usePlaneBuilderStore.getInitialState(), true);
  usePlaneBuilderStore.setState({
    progress: { ...newProgress(), lifetimeDistance: 1500, season: season() },
  });
});
afterEach(() => jest.useRealTimers());

/** Lets the sync's awaited reads and the submit settle. */
const settle = () => jest.advanceTimersByTimeAsync(0);

type Sync = {
  [K in "submit" | "readSeason" | "readOwnEntry"]: jest.Mock &
    NonNullable<LeaderboardSyncDeps[K]>;
};

function setup(over: Partial<Sync> = {}) {
  const deps: Sync = {
    submit: jest.fn().mockResolvedValue("ok"),
    readSeason: jest.fn().mockResolvedValue({ number: 2, startedAt: null }),
    readOwnEntry: jest.fn().mockResolvedValue("missing"),
    ...over,
  };
  const stop = createLeaderboardSync({
    enabled: true,
    now: () => Date.now(),
    ...deps,
  }).start();
  return { ...deps, stop };
}

const sent = (submit: jest.Mock, i: number) =>
  submit.mock.calls[i][0] as LeaderboardEntry;

it("sends the first flight with a generated nickname and the season score", async () => {
  const { submit, stop } = setup();
  await settle();
  usePlaneBuilderStore.setState({ lastFlight: flight() });
  await settle();
  expect(submit).toHaveBeenCalledTimes(1);
  const entry = sent(submit, 0);
  expect(isValidNickname(entry.nickname)).toBe(true);
  expect(entry.score).toBe(1500);
  stop();
});

it("submit carries seasonEntry and the season number", async () => {
  usePlaneBuilderStore.setState((s) => ({
    progress: {
      ...s.progress,
      nickname: "Happy Otter 7",
      prestige: { ...s.progress.prestige, level: 9 },
      lifetimeDistance: 9e6,
      season: season({
        prestiges: 1,
        distance: 4000,
        bestTimes: { meadow: 30 },
      }),
    },
  }));
  const { submit, stop } = setup();
  usePlaneBuilderStore.setState({ lastFlight: flight() });
  await settle();
  expect(submit).toHaveBeenCalledTimes(1);
  expect(submit.mock.calls[0]).toEqual([
    seasonEntry(usePlaneBuilderStore.getState().progress),
    2,
  ]);
  expect(sent(submit, 0)).toMatchObject({
    prestige: 1,
    lifetimeDistance: 4000,
    score: scoreFor(1, 4000),
  });
  stop();
});

it("sends at most once per 30 s, with a trailing submit of the latest data", async () => {
  const { submit, stop } = setup();
  await settle();
  usePlaneBuilderStore.setState({ lastFlight: flight() });
  await settle();
  jest.advanceTimersByTime(10_000);
  usePlaneBuilderStore.setState({ lastFlight: flight() });
  usePlaneBuilderStore.setState((s) => ({
    lastFlight: flight(),
    progress: { ...s.progress, season: season({ distance: 9000 }) },
  }));
  expect(submit).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(19_999);
  expect(submit).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1);
  expect(submit).toHaveBeenCalledTimes(2);
  expect(sent(submit, 1).score).toBe(9000);
  stop();
});

it("submits on prestige", async () => {
  const { submit, stop } = setup();
  usePlaneBuilderStore.setState((s) => ({
    progress: {
      ...s.progress,
      prestige: { ...s.progress.prestige, level: 1 },
      season: season({ prestiges: 1 }),
    },
  }));
  await settle();
  expect(submit).toHaveBeenCalledTimes(1);
  expect(sent(submit, 0).prestige).toBe(1);
  stop();
});

it("never throws when the submit fails", async () => {
  const { stop } = setup({
    submit: jest.fn().mockRejectedValue(new Error("offline")),
  });
  expect(() =>
    usePlaneBuilderStore.setState({ lastFlight: flight() })
  ).not.toThrow();
  await settle();
  stop();
});

it("does nothing when disabled", async () => {
  const submit = jest.fn();
  const readSeason = jest.fn();
  const stop = createLeaderboardSync({
    enabled: false,
    submit,
    readSeason,
  }).start();
  usePlaneBuilderStore.setState({ lastFlight: flight() });
  await settle();
  expect(submit).not.toHaveBeenCalled();
  expect(readSeason).not.toHaveBeenCalled();
  stop();
});

it("setNickname only accepts generated names", () => {
  usePlaneBuilderStore.getState().setNickname("Happy Otter 7");
  expect(usePlaneBuilderStore.getState().progress.nickname).toBe(
    "Happy Otter 7"
  );
  usePlaneBuilderStore.getState().setNickname("anything goes");
  expect(usePlaneBuilderStore.getState().progress.nickname).toBe(
    "Happy Otter 7"
  );
});

describe("board hidden switch", () => {
  it("starts hidden and reads the switch once on start", async () => {
    expect(usePlaneBuilderStore.getState().isBoardHidden).toBe(true);
    const readBoardHidden = jest.fn().mockResolvedValue(false);
    const sync = createLeaderboardSync({
      enabled: true,
      submit: jest.fn().mockResolvedValue("ok"),
      readSeason: jest.fn().mockResolvedValue({ number: 2, startedAt: null }),
      readOwnEntry: jest.fn().mockResolvedValue("missing"),
      readBoardHidden,
    });
    const stop = sync.start();
    await settle();
    expect(readBoardHidden).toHaveBeenCalledTimes(1);
    expect(usePlaneBuilderStore.getState().isBoardHidden).toBe(false);
    usePlaneBuilderStore.setState({ lastFlight: flight() });
    await settle();
    expect(readBoardHidden).toHaveBeenCalledTimes(1);
    stop();
  });

  it("keeps submitting while the board is hidden", async () => {
    const readBoardHidden = jest.fn().mockResolvedValue(true);
    const submit = jest.fn().mockResolvedValue("ok");
    const stop = createLeaderboardSync({
      enabled: true,
      submit,
      readSeason: jest.fn().mockResolvedValue({ number: 2, startedAt: null }),
      readOwnEntry: jest.fn().mockResolvedValue("missing"),
      readBoardHidden,
    }).start();
    usePlaneBuilderStore.setState({ lastFlight: flight() });
    await settle();
    expect(usePlaneBuilderStore.getState().isBoardHidden).toBe(true);
    expect(submit).toHaveBeenCalledTimes(1);
    stop();
  });

  it("stays hidden when the read fails", async () => {
    const stop = createLeaderboardSync({
      enabled: true,
      submit: jest.fn().mockResolvedValue("ok"),
      readSeason: jest.fn().mockResolvedValue(null),
      readOwnEntry: jest.fn().mockResolvedValue("missing"),
      readBoardHidden: jest.fn().mockRejectedValue(new Error("offline")),
    }).start();
    await settle();
    expect(usePlaneBuilderStore.getState().isBoardHidden).toBe(true);
    stop();
  });

  it("makes no read when disabled", async () => {
    const readBoardHidden = jest.fn();
    createLeaderboardSync({ enabled: false, readBoardHidden }).start();
    await settle();
    expect(readBoardHidden).not.toHaveBeenCalled();
  });
});

describe("seasons", () => {
  it("no season read, no submit", async () => {
    const { submit, stop } = setup({
      readSeason: jest.fn().mockResolvedValue(null),
    });
    usePlaneBuilderStore.setState({ lastFlight: flight() });
    await settle();
    expect(submit).not.toHaveBeenCalled();
    expect(usePlaneBuilderStore.getState().currentSeason).toBeNull();
    stop();
  });

  it("never writes season 1, the frozen board", async () => {
    const { submit, stop } = setup({
      readSeason: jest.fn().mockResolvedValue({ number: 1, startedAt: null }),
    });
    usePlaneBuilderStore.setState({ lastFlight: flight() });
    await settle();
    expect(submit).not.toHaveBeenCalled();
    stop();
  });

  it("reads the season on start, before any flight", async () => {
    const { readSeason, stop } = setup();
    await settle();
    expect(readSeason).toHaveBeenCalledTimes(1);
    expect(usePlaneBuilderStore.getState().currentSeason).toBe(2);
    stop();
  });

  it("newer season resets stats once and sets newSeasonNote", async () => {
    const { submit, readSeason, stop } = setup({
      readSeason: jest.fn().mockResolvedValue({ number: 3, startedAt: null }),
    });
    await settle();
    const s = usePlaneBuilderStore.getState();
    expect(s.currentSeason).toBe(3);
    expect(s.newSeasonNote).toBe(true);
    expect(s.progress.season).toMatchObject({ number: 3, distance: 0 });
    // New season play counts and is not reset again by later reads.
    usePlaneBuilderStore.setState((st) => ({
      progress: {
        ...st.progress,
        season: { ...st.progress.season, distance: 700 },
      },
    }));
    await jest.advanceTimersByTimeAsync(SEASON_READ_MS + 1);
    usePlaneBuilderStore.setState({ lastFlight: flight() });
    await settle();
    expect(readSeason).toHaveBeenCalledTimes(2);
    expect(usePlaneBuilderStore.getState().progress.season.distance).toBe(700);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0][1]).toBe(3);
    expect(sent(submit, 0).lifetimeDistance).toBe(700);
    stop();
  });

  it("same season does not reset", async () => {
    const before = usePlaneBuilderStore.getState().progress;
    const { stop } = setup();
    await settle();
    expect(usePlaneBuilderStore.getState().progress).toBe(before);
    expect(usePlaneBuilderStore.getState().newSeasonNote).toBe(false);
    stop();
  });

  it("re-reads the season only when the last read is over 10 minutes old", async () => {
    const { readSeason, submit, stop } = setup();
    await settle();
    usePlaneBuilderStore.setState({ lastFlight: flight() });
    await settle();
    await jest.advanceTimersByTimeAsync(SUBMIT_INTERVAL_MS);
    usePlaneBuilderStore.setState({ lastFlight: flight() });
    await settle();
    expect(submit).toHaveBeenCalledTimes(2);
    expect(readSeason).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(SEASON_READ_MS);
    usePlaneBuilderStore.setState({ lastFlight: flight() });
    await settle();
    expect(readSeason).toHaveBeenCalledTimes(2);
    stop();
  });
});

describe("adopts a name the admin set", () => {
  const own = (nickname: string): OwnEntry => ({
    nickname,
    prestige: 0,
    lifetimeDistance: 1500,
    updatedAt: null,
  });

  beforeEach(() => {
    const { progress } = usePlaneBuilderStore.getState();
    usePlaneBuilderStore
      .getState()
      .hydrate({ ...progress, nickname: "Happy Otter 7" });
  });

  it("does not revert a reroll when the sync started before the save loaded", async () => {
    // PlaneBuilder starts the sync before its hydrate effect runs.
    usePlaneBuilderStore.setState(usePlaneBuilderStore.getInitialState(), true);
    const { submit, stop } = setup({
      readOwnEntry: jest.fn().mockResolvedValue(own("Happy Otter 7")),
    });
    usePlaneBuilderStore.getState().hydrate({
      ...newProgress(),
      nickname: "Happy Otter 7",
      season: season(),
    });
    await settle();
    usePlaneBuilderStore.getState().setNickname("Swift Falcon 2");
    usePlaneBuilderStore.setState({ lastFlight: flight() });
    await settle();
    expect(usePlaneBuilderStore.getState().progress.nickname).toBe(
      "Swift Falcon 2"
    );
    expect(sent(submit, 0).nickname).toBe("Swift Falcon 2");
    stop();
  });

  it("takes the board's name when it differs from the one last sent", async () => {
    const { submit, stop } = setup({
      readOwnEntry: jest.fn().mockResolvedValue(own("Brave Panda 3")),
    });
    usePlaneBuilderStore.setState({ lastFlight: flight() });
    await settle();
    expect(usePlaneBuilderStore.getState().progress.nickname).toBe(
      "Brave Panda 3"
    );
    expect(sent(submit, 0).nickname).toBe("Brave Panda 3");
    stop();
  });

  it("leaves the name alone when the board has the one last sent", async () => {
    const { submit, stop } = setup({
      readOwnEntry: jest.fn().mockResolvedValue(own("Happy Otter 7")),
    });
    usePlaneBuilderStore.setState({ lastFlight: flight() });
    await settle();
    expect(usePlaneBuilderStore.getState().progress.nickname).toBe(
      "Happy Otter 7"
    );
    expect(sent(submit, 0).nickname).toBe("Happy Otter 7");
    stop();
  });

  it("does not revert a just-rerolled name that is not sent yet", async () => {
    const { submit, stop } = setup({
      readOwnEntry: jest.fn().mockResolvedValue(own("Happy Otter 7")),
    });
    await settle();
    usePlaneBuilderStore.getState().setNickname("Swift Falcon 2");
    usePlaneBuilderStore.setState({ lastFlight: flight() });
    await settle();
    expect(usePlaneBuilderStore.getState().progress.nickname).toBe(
      "Swift Falcon 2"
    );
    expect(sent(submit, 0).nickname).toBe("Swift Falcon 2");
    stop();
  });
});

/**
 * A stand-in for the season entry doc and the plane rules in
 * firestore.rules (validLeaderboardCreate / validLeaderboardUpdate).
 */
function fakeServer(seasonStartedAt = Number.NEGATIVE_INFINITY) {
  let doc: (LeaderboardEntry & { updatedAt: number }) | null = null;
  const log: { entry: LeaderboardEntry; result: CommitResult }[] = [];
  const coherent = (d: LeaderboardEntry) =>
    d.fastestRun === null ||
    (LEVEL_ORDER.every((id) => d.bestTimes[id] !== undefined) &&
      d.lifetimeDistance >= RUN_DISTANCE);
  const allowed = (d: LeaderboardEntry): boolean => {
    if (d.score !== scoreFor(d.prestige, d.lifetimeDistance)) return false;
    if (!coherent(d)) return false;
    if (doc === null) {
      const sinceStart = (Date.now() - seasonStartedAt) / 1000;
      return (
        d.prestige <= 1 &&
        d.lifetimeDistance <= 150000 &&
        d.lifetimeDistance <= 200 * sinceStart + 9100
      );
    }
    const secs = (Date.now() - doc.updatedAt) / 1000;
    return (
      secs >= 10 &&
      d.prestige >= doc.prestige &&
      (d.prestige - 1) * RUN_DISTANCE <= d.lifetimeDistance &&
      d.lifetimeDistance >= doc.lifetimeDistance &&
      d.lifetimeDistance <= doc.lifetimeDistance + 200 * secs + 9100
    );
  };
  return {
    log,
    get doc() {
      return doc;
    },
    submit: jest.fn(async (entry: LeaderboardEntry): Promise<CommitResult> => {
      const result = allowed(entry) ? "ok" : "refused";
      if (result === "ok") doc = { ...entry, updatedAt: Date.now() };
      log.push({ entry, result });
      return result;
    }),
    readOwnEntry: jest.fn(async (): Promise<OwnEntry | "missing"> =>
      doc === null
        ? "missing"
        : {
            nickname: doc.nickname,
            prestige: doc.prestige,
            lifetimeDistance: doc.lifetimeDistance,
            updatedAt: doc.updatedAt,
          }
    ),
    /** The admin's "New name": only the name and updatedAt change. */
    rename(nickname: string) {
      if (doc) doc = { ...doc, nickname, updatedAt: Date.now() };
    },
    /** Puts an entry on the board as if written earlier. */
    seed(entry: LeaderboardEntry) {
      doc = { ...entry, updatedAt: Date.now() };
    },
  };
}

describe("refused first write climbs back", () => {
  const allTimes = Object.fromEntries(LEVEL_ORDER.map((id) => [id, 100]));

  beforeEach(() => {
    usePlaneBuilderStore.setState((s) => ({
      progress: {
        ...s.progress,
        nickname: "Happy Otter 7",
        season: season({
          prestiges: 4,
          distance: 600000,
          bestTimes: allTimes,
          fastestRun: 12,
        }),
      },
    }));
  });

  async function climb(server: ReturnType<typeof fakeServer>) {
    usePlaneBuilderStore.setState({ lastFlight: flight() });
    await settle();
    for (let i = 0; i < 100 && server.doc?.score !== target().score; i++) {
      await jest.advanceTimersByTimeAsync(SUBMIT_INTERVAL_MS);
    }
  }
  const target = () => seasonEntry(usePlaneBuilderStore.getState().progress);

  function expectSteadyClimb(server: ReturnType<typeof fakeServer>) {
    const accepted = server.log.filter((l) => l.result === "ok");
    const [first, ...rest] = accepted.map((l) => l.entry);
    expect(first.prestige).toBeLessThanOrEqual(1);
    expect(first.lifetimeDistance).toBeLessThanOrEqual(CREATE_MAX_DISTANCE);
    expect(first.fastestRun).toBeNull();
    let previous = first;
    for (const entry of rest) {
      expect(entry.lifetimeDistance).toBeGreaterThan(previous.lifetimeDistance);
      expect(entry.prestige).toBeGreaterThanOrEqual(previous.prestige);
      previous = entry;
    }
    expect(server.doc).toMatchObject(target());
  }

  it("with the doc known to be missing, climbs without a refusal", async () => {
    const server = fakeServer();
    const { stop } = setup(server);
    await climb(server);
    expect(server.log.every((l) => l.result === "ok")).toBe(true);
    expectSteadyClimb(server);
    stop();
  });

  it("when the doc can't be read, a refused full write falls back to the climb", async () => {
    const server = fakeServer();
    const { stop } = setup({
      submit: server.submit,
      readOwnEntry: jest.fn().mockResolvedValue(null),
    });
    await climb(server);
    expect(server.log[0]).toMatchObject({ result: "refused" });
    expect(server.log[0].entry).toEqual(target());
    const firstOk = server.log.findIndex((l) => l.result === "ok");
    expect(firstOk).toBeGreaterThan(0);
    expect(server.log.slice(firstOk).every((l) => l.result === "ok")).toBe(
      true
    );
    expectSteadyClimb(server);
    stop();
  });

  it("climbs from an entry already on the board (say, after a reload)", async () => {
    const server = fakeServer();
    await server.submit({
      ...target(),
      prestige: 1,
      lifetimeDistance: 100000,
      score: scoreFor(1, 100000),
      fastestRun: null,
    });
    await jest.advanceTimersByTimeAsync(5_000);
    const { stop } = setup(server);
    await climb(server);
    expect(server.doc).toMatchObject(target());
    expect(
      server.log.filter((l) => l.result === "refused").length
    ).toBeLessThanOrEqual(1);
    stop();
  });

  it("stops asking when there is nothing more to climb", async () => {
    const server = fakeServer();
    const { stop } = setup(server);
    await climb(server);
    const writes = server.log.length;
    await jest.advanceTimersByTimeAsync(SUBMIT_INTERVAL_MS * 5);
    expect(server.log.length).toBe(writes);
    stop();
  });
});

describe("climb edge cases", () => {
  const allTimes = Object.fromEntries(LEVEL_ORDER.map((id) => [id, 100]));
  const big = () =>
    usePlaneBuilderStore.setState((s) => ({
      progress: {
        ...s.progress,
        nickname: "Happy Otter 7",
        season: season({
          prestiges: 4,
          distance: 600000,
          bestTimes: allTimes,
          fastestRun: 12,
        }),
      },
    }));
  const target = () => seasonEntry(usePlaneBuilderStore.getState().progress);

  it("early in a season the first write fits the time since it began", async () => {
    big();
    const startedAt = Date.now() - 60_000;
    const server = fakeServer(startedAt);
    const { stop } = setup({
      ...server,
      readSeason: jest
        .fn()
        .mockResolvedValue({ number: 2, startedAt: new Date(startedAt) }),
    });
    usePlaneBuilderStore.setState({ lastFlight: flight() });
    await settle();
    for (let i = 0; i < 100 && server.doc?.score !== target().score; i++) {
      await jest.advanceTimersByTimeAsync(SUBMIT_INTERVAL_MS);
    }
    expect(server.log[0].result).toBe("ok");
    expect(server.log[0].entry.lifetimeDistance).toBeLessThanOrEqual(
      200 * 60 + 9100
    );
    expect(server.log.every((l) => l.result === "ok")).toBe(true);
    expect(server.doc).toMatchObject(target());
    stop();
  });

  it("an admin rename resets the climb's clock", async () => {
    big();
    const server = fakeServer();
    const { stop } = setup(server);
    usePlaneBuilderStore.setState({ lastFlight: flight() });
    await settle();
    await jest.advanceTimersByTimeAsync(SUBMIT_INTERVAL_MS);
    expect(server.log.map((l) => l.result)).toEqual(["ok", "ok"]);
    // Renamed 15 s before the next write: only 15 s of climb are allowed.
    await jest.advanceTimersByTimeAsync(15_000);
    server.rename("Brave Panda 3");
    await jest.advanceTimersByTimeAsync(SUBMIT_INTERVAL_MS - 15_000);
    expect(server.log).toHaveLength(3);
    expect(server.log[2].result).toBe("ok");
    expect(server.log[2].entry.nickname).toBe("Brave Panda 3");
    stop();
  });

  it("never sends less than the board already holds", async () => {
    const server = fakeServer();
    server.seed({
      nickname: "Happy Otter 7",
      prestige: 3,
      score: scoreFor(3, 300000),
      lifetimeDistance: 300000,
      bestTimes: {},
      fastestRun: null,
    });
    await jest.advanceTimersByTimeAsync(60_000);
    usePlaneBuilderStore.setState((s) => ({
      progress: {
        ...s.progress,
        nickname: "Happy Otter 7",
        season: season({ prestiges: 1, distance: 100000 }),
      },
    }));
    const { stop } = setup(server);
    usePlaneBuilderStore.setState({ lastFlight: flight() });
    await settle();
    expect(server.log[0].result).toBe("ok");
    expect(server.log[0].entry).toMatchObject({
      prestige: 3,
      lifetimeDistance: 300000,
    });
    // Nothing left to climb: no more writes until the next flight.
    await jest.advanceTimersByTimeAsync(SUBMIT_INTERVAL_MS * 4);
    expect(server.log).toHaveLength(1);
    stop();
  });
});
