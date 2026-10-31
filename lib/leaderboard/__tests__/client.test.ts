import {
  buildBoardQuery,
  buildSubmitBody,
  commitUrl,
  fetchBoard,
  fetchOwnEntry,
  runQueryUrl,
  submitEntry,
  submitEntryResult,
} from "../client";
import { scoreFor } from "../types";
import type { LeaderboardEntry } from "../types";

const config = {
  apiKey: "KEY",
  authDomain: "x",
  projectId: "proj",
  appId: "x",
};

const entry: LeaderboardEntry = {
  nickname: "Happy Otter 7",
  prestige: 2,
  score: scoreFor(2, 1234.9),
  lifetimeDistance: 1234.9,
  bestTimes: { meadow: 21.5, canyon: 40 },
  fastestRun: null,
};

describe("scoreFor", () => {
  it("is prestige * 1e9 + floored distance", () => {
    expect(scoreFor(0, 0)).toBe(0);
    expect(scoreFor(2, 1234.9)).toBe(2_000_001_234);
  });

  it("caps the distance part at 999999999", () => {
    expect(scoreFor(1, 5e12)).toBe(1_999_999_999);
  });
});

describe("buildSubmitBody", () => {
  it("encodes the exact REST document with a REQUEST_TIME transform", () => {
    expect(buildSubmitBody("proj", "uid-1", entry, 1)).toEqual({
      writes: [
        {
          update: {
            name: "projects/proj/databases/(default)/documents/leaderboard/uid-1",
            fields: {
              nickname: { stringValue: "Happy Otter 7" },
              prestige: { integerValue: "2" },
              score: { integerValue: "2000001234" },
              lifetimeDistance: { doubleValue: 1234.9 },
              bestTimes: {
                mapValue: {
                  fields: {
                    meadow: { doubleValue: 21.5 },
                    canyon: { doubleValue: 40 },
                  },
                },
              },
              fastestRun: { nullValue: null },
            },
          },
          updateTransforms: [
            { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" },
          ],
        },
      ],
    });
  });

  it("encodes a fastestRun as an integer and empty bestTimes as an empty map", () => {
    const body = buildSubmitBody(
      "proj",
      "u",
      { ...entry, bestTimes: {}, fastestRun: 900 },
      1
    );
    const { fields } = body.writes[0].update;
    expect(fields.fastestRun).toEqual({ integerValue: "900" });
    expect(fields.bestTimes).toEqual({ mapValue: { fields: {} } });
  });
});

describe("urls", () => {
  it("targets the Firestore REST endpoints", () => {
    expect(commitUrl(config)).toBe(
      "https://firestore.googleapis.com/v1/projects/proj/databases/(default)/documents:commit?key=KEY"
    );
    expect(runQueryUrl(config, "http://h")).toBe(
      "http://h/v1/projects/proj/databases/(default)/documents:runQuery?key=KEY"
    );
  });
});

describe("submitEntry", () => {
  const getSession = async () => ({ uid: "uid-1", idToken: "tok" });

  it("posts with the bearer token and resolves true on success", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true });
    expect(await submitEntry(entry, 1, { config, fetchImpl, getSession })).toBe(
      true
    );
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(commitUrl(config));
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toEqual(
      buildSubmitBody("proj", "uid-1", entry, 1)
    );
  });

  it("resolves false when rejected, offline, signed out or unconfigured", async () => {
    expect(
      await submitEntry(entry, 1, {
        config,
        getSession,
        fetchImpl: jest.fn().mockResolvedValue({ ok: false }),
      })
    ).toBe(false);
    expect(
      await submitEntry(entry, 1, {
        config,
        getSession,
        fetchImpl: jest.fn().mockRejectedValue(new Error("offline")),
      })
    ).toBe(false);
    const fetchImpl = jest.fn();
    expect(
      await submitEntry(entry, 1, {
        config,
        fetchImpl,
        getSession: async () => null,
      })
    ).toBe(false);
    expect(
      await submitEntry(entry, 1, {
        config: { ...config, apiKey: "" },
        fetchImpl,
        getSession,
      })
    ).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("never throws when the session lookup throws", async () => {
    await expect(
      submitEntry(entry, 1, {
        config,
        getSession: async () => {
          throw new Error("boom");
        },
      })
    ).resolves.toBe(false);
  });
});

describe("seasons", () => {
  const getSession = async () => ({ uid: "uid-1", idToken: "tok" });

  it("writes season 1 to leaderboard/{uid} and later seasons to planeSeasons/{n}/entries/{uid}", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true });
    await submitEntry(entry, 1, { config, fetchImpl, getSession });
    await submitEntry(entry, 3, { config, fetchImpl, getSession });
    const names = fetchImpl.mock.calls.map(
      ([, init]) => JSON.parse(init.body).writes[0].update.name
    );
    expect(names).toEqual([
      "projects/proj/databases/(default)/documents/leaderboard/uid-1",
      "projects/proj/databases/(default)/documents/planeSeasons/3/entries/uid-1",
    ]);
    for (const [url] of fetchImpl.mock.calls)
      expect(url).toBe(commitUrl(config));
  });

  it("queries season 1 at the root and later seasons under their season doc", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => [] });
    await fetchBoard("prestige", 1, { config, fetchImpl });
    await fetchBoard("prestige", 3, { config, fetchImpl });
    const [[rootUrl, rootInit], [seasonUrl, seasonInit]] = fetchImpl.mock.calls;
    expect(rootUrl).toBe(runQueryUrl(config));
    expect(JSON.parse(rootInit.body).structuredQuery.from).toEqual([
      { collectionId: "leaderboard" },
    ]);
    expect(seasonUrl).toContain("documents/planeSeasons/3:runQuery");
    expect(seasonUrl).toBe(
      "https://firestore.googleapis.com/v1/projects/proj/databases/(default)/documents/planeSeasons/3:runQuery?key=KEY"
    );
    expect(JSON.parse(seasonInit.body).structuredQuery.from).toEqual([
      { collectionId: "entries" },
    ]);
  });

  it("builds a season query on the entries subcollection", () => {
    expect(buildBoardQuery("prestige", 2).structuredQuery.from).toEqual([
      { collectionId: "entries" },
    ]);
  });

  it("parses rows of a season board", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          document: {
            name: "projects/proj/databases/(default)/documents/planeSeasons/2/entries/u9",
            fields: {
              nickname: { stringValue: "Happy Otter 7" },
              score: { integerValue: "5" },
            },
          },
        },
      ],
    });
    expect(await fetchBoard("prestige", 2, { config, fetchImpl })).toEqual([
      { uid: "u9", nickname: "Happy Otter 7", value: 5 },
    ]);
  });
});

describe("buildBoardQuery", () => {
  const from = [{ collectionId: "leaderboard" }];

  it("prestige: score descending, limit 50", () => {
    expect(buildBoardQuery("prestige", 1)).toEqual({
      structuredQuery: {
        from,
        orderBy: [{ field: { fieldPath: "score" }, direction: "DESCENDING" }],
        limit: 50,
      },
    });
  });

  it("fastestRun: ascending with a > 0 filter", () => {
    expect(buildBoardQuery("fastestRun", 1)).toEqual({
      structuredQuery: {
        from,
        where: {
          fieldFilter: {
            field: { fieldPath: "fastestRun" },
            op: "GREATER_THAN",
            value: { integerValue: "0" },
          },
        },
        orderBy: [
          { field: { fieldPath: "fastestRun" }, direction: "ASCENDING" },
        ],
        limit: 50,
      },
    });
  });

  it("a world: bestTimes.<id> ascending", () => {
    expect(buildBoardQuery({ world: "canyon" }, 1)).toEqual({
      structuredQuery: {
        from,
        orderBy: [
          {
            field: { fieldPath: "bestTimes.canyon" },
            direction: "ASCENDING",
          },
        ],
        limit: 50,
      },
    });
  });
});

describe("fetchBoard", () => {
  const doc = (id: string, fields: Record<string, unknown>) => ({
    document: {
      name: `projects/proj/databases/(default)/documents/leaderboard/${id}`,
      fields: { nickname: { stringValue: `Nick ${id}` }, ...fields },
    },
    readTime: "t",
  });

  const ok = (json: unknown) =>
    jest.fn().mockResolvedValue({ ok: true, json: async () => json });

  it("parses prestige rows from score", async () => {
    const fetchImpl = ok([
      doc("a", { score: { integerValue: "3000000005" } }),
      doc("b", { score: { integerValue: "1" } }),
    ]);
    expect(await fetchBoard("prestige", 1, { config, fetchImpl })).toEqual([
      { uid: "a", nickname: "Nick a", value: 3000000005 },
      { uid: "b", nickname: "Nick b", value: 1 },
    ]);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(runQueryUrl(config));
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("parses fastestRun and per-world values, skipping bad rows", async () => {
    expect(
      await fetchBoard("fastestRun", 1, {
        config,
        fetchImpl: ok([
          doc("a", { fastestRun: { integerValue: "900" } }),
          doc("bad", { fastestRun: { stringValue: "x" } }),
          { readTime: "empty result" },
        ]),
      })
    ).toEqual([{ uid: "a", nickname: "Nick a", value: 900 }]);

    expect(
      await fetchBoard({ world: "canyon" }, 1, {
        config,
        fetchImpl: ok([
          doc("a", {
            bestTimes: {
              mapValue: { fields: { canyon: { doubleValue: 41.25 } } },
            },
          }),
          doc("nope", { bestTimes: { mapValue: { fields: {} } } }),
        ]),
      })
    ).toEqual([{ uid: "a", nickname: "Nick a", value: 41.25 }]);
  });

  it("returns an empty list for an empty or non-array response", async () => {
    expect(
      await fetchBoard("prestige", 1, { config, fetchImpl: ok([]) })
    ).toEqual([]);
    expect(
      await fetchBoard("prestige", 1, { config, fetchImpl: ok({ error: 1 }) })
    ).toEqual([]);
  });

  it("returns null on HTTP errors, network errors and when unconfigured", async () => {
    expect(
      await fetchBoard("prestige", 1, {
        config,
        fetchImpl: jest.fn().mockResolvedValue({ ok: false }),
      })
    ).toBeNull();
    expect(
      await fetchBoard("prestige", 1, {
        config,
        fetchImpl: jest.fn().mockRejectedValue(new Error("offline")),
      })
    ).toBeNull();
    expect(
      await fetchBoard("prestige", 1, {
        config: { ...config, projectId: "" },
        fetchImpl: ok([]),
      })
    ).toBeNull();
  });
});

describe("submitEntryResult", () => {
  const getSession = async () => ({ uid: "uid-1", idToken: "tok" });

  it("tells a refusal from a failure to deliver", async () => {
    const reply = (value: unknown) => ({
      config,
      getSession,
      fetchImpl: jest.fn().mockResolvedValue(value),
    });
    expect(await submitEntryResult(entry, 2, reply({ ok: true }))).toBe("ok");
    expect(
      await submitEntryResult(entry, 2, reply({ ok: false, status: 403 }))
    ).toBe("refused");
    expect(
      await submitEntryResult(entry, 2, reply({ ok: false, status: 500 }))
    ).toBe("error");
  });
});

describe("fetchOwnEntry", () => {
  const getSession = async () => ({ uid: "uid-1", idToken: "tok" });
  const doc = {
    name: "projects/proj/databases/(default)/documents/planeSeasons/2/entries/uid-1",
    fields: {
      nickname: { stringValue: "Brave Panda 3" },
      prestige: { integerValue: "2" },
      lifetimeDistance: { doubleValue: 140000.5 },
    },
  };

  it("GETs the player's own doc in the season and parses it", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => doc });
    expect(await fetchOwnEntry(2, { config, fetchImpl, getSession })).toEqual({
      nickname: "Brave Panda 3",
      prestige: 2,
      lifetimeDistance: 140000.5,
    });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(
      "https://firestore.googleapis.com/v1/projects/proj/databases/(default)/documents/planeSeasons/2/entries/uid-1?key=KEY"
    );
    expect(init.method).toBe("GET");
  });

  it("reads season 1 from the legacy collection", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => doc });
    await fetchOwnEntry(1, { config, fetchImpl, getSession });
    expect(fetchImpl.mock.calls[0][0]).toContain(
      "documents/leaderboard/uid-1?"
    );
  });

  it("is 'missing' on a 404", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 404 });
    expect(await fetchOwnEntry(2, { config, fetchImpl, getSession })).toBe(
      "missing"
    );
  });

  it("is null on errors, junk, no session or no config", async () => {
    const run = (deps: Parameters<typeof fetchOwnEntry>[1]) =>
      fetchOwnEntry(2, { config, getSession, ...deps });
    expect(
      await run({
        fetchImpl: jest.fn().mockResolvedValue({ ok: false, status: 500 }),
      })
    ).toBeNull();
    expect(
      await run({
        fetchImpl: jest.fn().mockRejectedValue(new Error("offline")),
      })
    ).toBeNull();
    expect(
      await run({
        fetchImpl: jest
          .fn()
          .mockResolvedValue({ ok: true, json: async () => ({ fields: {} }) }),
      })
    ).toBeNull();
    const fetchImpl = jest.fn();
    expect(await run({ fetchImpl, getSession: async () => null })).toBeNull();
    expect(
      await run({ fetchImpl, config: { ...config, apiKey: "" } })
    ).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("App Check headers", () => {
  const getSession = async () => ({ uid: "u1", idToken: "tok" });
  const getAppCheckHeaders = async () => ({ "X-Firebase-AppCheck": "AC" });

  it("rides on writes and on board reads when there is a token", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => [] });
    await submitEntry(entry, 1, {
      config,
      fetchImpl,
      getSession,
      getAppCheckHeaders,
    });
    await fetchBoard("prestige", 1, { config, fetchImpl, getAppCheckHeaders });
    await fetchOwnEntry(2, {
      config,
      fetchImpl,
      getSession,
      getAppCheckHeaders,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    for (const call of fetchImpl.mock.calls) {
      expect(call[1].headers["X-Firebase-AppCheck"]).toBe("AC");
    }
  });

  it("is absent when there is no token", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => [] });
    await submitEntry(entry, 1, {
      config,
      fetchImpl,
      getSession,
      getAppCheckHeaders: async () => ({}),
    });
    await fetchBoard("prestige", 1, {
      config,
      fetchImpl,
      getAppCheckHeaders: async () => ({}),
    });
    for (const call of fetchImpl.mock.calls) {
      expect(call[1].headers).not.toHaveProperty("X-Firebase-AppCheck");
    }
  });
});
