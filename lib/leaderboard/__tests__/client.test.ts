import {
  buildBoardQuery,
  buildSubmitBody,
  commitUrl,
  fetchBoard,
  runQueryUrl,
  submitEntry,
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
    expect(buildSubmitBody("proj", "uid-1", entry)).toEqual({
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
    const body = buildSubmitBody("proj", "u", {
      ...entry,
      bestTimes: {},
      fastestRun: 900,
    });
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
    expect(await submitEntry(entry, { config, fetchImpl, getSession })).toBe(
      true
    );
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(commitUrl(config));
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toEqual(
      buildSubmitBody("proj", "uid-1", entry)
    );
  });

  it("resolves false when rejected, offline, signed out or unconfigured", async () => {
    expect(
      await submitEntry(entry, {
        config,
        getSession,
        fetchImpl: jest.fn().mockResolvedValue({ ok: false }),
      })
    ).toBe(false);
    expect(
      await submitEntry(entry, {
        config,
        getSession,
        fetchImpl: jest.fn().mockRejectedValue(new Error("offline")),
      })
    ).toBe(false);
    const fetchImpl = jest.fn();
    expect(
      await submitEntry(entry, {
        config,
        fetchImpl,
        getSession: async () => null,
      })
    ).toBe(false);
    expect(
      await submitEntry(entry, {
        config: { ...config, apiKey: "" },
        fetchImpl,
        getSession,
      })
    ).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("never throws when the session lookup throws", async () => {
    await expect(
      submitEntry(entry, {
        config,
        getSession: async () => {
          throw new Error("boom");
        },
      })
    ).resolves.toBe(false);
  });
});

describe("buildBoardQuery", () => {
  const from = [{ collectionId: "leaderboard" }];

  it("prestige: score descending, limit 50", () => {
    expect(buildBoardQuery("prestige")).toEqual({
      structuredQuery: {
        from,
        orderBy: [{ field: { fieldPath: "score" }, direction: "DESCENDING" }],
        limit: 50,
      },
    });
  });

  it("fastestRun: ascending with a > 0 filter", () => {
    expect(buildBoardQuery("fastestRun")).toEqual({
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
    expect(buildBoardQuery({ world: "canyon" })).toEqual({
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
    expect(await fetchBoard("prestige", { config, fetchImpl })).toEqual([
      { uid: "a", nickname: "Nick a", value: 3000000005 },
      { uid: "b", nickname: "Nick b", value: 1 },
    ]);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(runQueryUrl(config));
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("parses fastestRun and per-world values, skipping bad rows", async () => {
    expect(
      await fetchBoard("fastestRun", {
        config,
        fetchImpl: ok([
          doc("a", { fastestRun: { integerValue: "900" } }),
          doc("bad", { fastestRun: { stringValue: "x" } }),
          { readTime: "empty result" },
        ]),
      })
    ).toEqual([{ uid: "a", nickname: "Nick a", value: 900 }]);

    expect(
      await fetchBoard(
        { world: "canyon" },
        {
          config,
          fetchImpl: ok([
            doc("a", {
              bestTimes: {
                mapValue: { fields: { canyon: { doubleValue: 41.25 } } },
              },
            }),
            doc("nope", { bestTimes: { mapValue: { fields: {} } } }),
          ]),
        }
      )
    ).toEqual([{ uid: "a", nickname: "Nick a", value: 41.25 }]);
  });

  it("returns an empty list for an empty or non-array response", async () => {
    expect(await fetchBoard("prestige", { config, fetchImpl: ok([]) })).toEqual(
      []
    );
    expect(
      await fetchBoard("prestige", { config, fetchImpl: ok({ error: 1 }) })
    ).toEqual([]);
  });

  it("returns null on HTTP errors, network errors and when unconfigured", async () => {
    expect(
      await fetchBoard("prestige", {
        config,
        fetchImpl: jest.fn().mockResolvedValue({ ok: false }),
      })
    ).toBeNull();
    expect(
      await fetchBoard("prestige", {
        config,
        fetchImpl: jest.fn().mockRejectedValue(new Error("offline")),
      })
    ).toBeNull();
    expect(
      await fetchBoard("prestige", {
        config: { ...config, projectId: "" },
        fetchImpl: ok([]),
      })
    ).toBeNull();
  });
});
