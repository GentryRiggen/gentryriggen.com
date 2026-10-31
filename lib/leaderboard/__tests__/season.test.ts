import {
  FIRST_SEASON,
  fetchSeason,
  seasonCollection,
  seasonQueryTarget,
  seasonUrl,
} from "../season";

const config = {
  apiKey: "KEY",
  authDomain: "x",
  projectId: "proj",
  appId: "x",
};
const noAppCheck = async () => ({});

describe("seasonCollection", () => {
  it("keeps season 1 in the legacy collections", () => {
    expect(FIRST_SEASON).toBe(1);
    expect(seasonCollection("plane", 1)).toBe("leaderboard");
    expect(seasonCollection("ship", 1)).toBe("shipLeaderboard");
  });

  it("puts later seasons in per-season subcollections", () => {
    expect(seasonCollection("plane", 3)).toBe("planeSeasons/3/entries");
    expect(seasonCollection("ship", 2)).toBe("shipSeasons/2/entries");
  });
});

describe("seasonQueryTarget", () => {
  it("queries season 1 at the root and later seasons under their parent", () => {
    expect(seasonQueryTarget("plane", 1)).toEqual({
      parent: "",
      collectionId: "leaderboard",
    });
    expect(seasonQueryTarget("ship", 1)).toEqual({
      parent: "",
      collectionId: "shipLeaderboard",
    });
    expect(seasonQueryTarget("plane", 3)).toEqual({
      parent: "planeSeasons/3",
      collectionId: "entries",
    });
    expect(seasonQueryTarget("ship", 2)).toEqual({
      parent: "shipSeasons/2",
      collectionId: "entries",
    });
  });
});

describe("fetchSeason", () => {
  const reply = (status: number, json?: unknown) =>
    jest.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => json,
    });

  it("GETs seasons/{game} without auth", async () => {
    const fetchImpl = reply(404);
    await fetchSeason("ship", {
      config,
      fetchImpl,
      getAppCheckHeaders: async () => ({ "X-Firebase-AppCheck": "AC" }),
    });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(seasonUrl(config, "ship"));
    expect(url).toBe(
      "https://firestore.googleapis.com/v1/projects/proj/databases/(default)/documents/seasons/ship?key=KEY"
    );
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBeUndefined();
    expect(init.headers["X-Firebase-AppCheck"]).toBe("AC");
  });

  it("is season 1 with no start when the doc does not exist", async () => {
    expect(
      await fetchSeason("plane", {
        config,
        fetchImpl: reply(404),
        getAppCheckHeaders: noAppCheck,
      })
    ).toEqual({ number: 1, startedAt: null });
  });

  it("parses the number and start time of a season doc", async () => {
    const fetchImpl = reply(200, {
      name: "projects/proj/databases/(default)/documents/seasons/plane",
      fields: {
        number: { integerValue: "3" },
        startedAt: { timestampValue: "2026-10-30T12:00:00.123456Z" },
      },
    });
    const season = await fetchSeason("plane", {
      config,
      fetchImpl,
      getAppCheckHeaders: noAppCheck,
    });
    expect(season?.number).toBe(3);
    expect(season?.startedAt?.toISOString()).toBe("2026-10-30T12:00:00.123Z");
  });

  it("gives a null start for a missing or bad startedAt", async () => {
    const season = await fetchSeason("plane", {
      config,
      fetchImpl: reply(200, {
        fields: {
          number: { integerValue: "2" },
          startedAt: { timestampValue: "nope" },
        },
      }),
      getAppCheckHeaders: noAppCheck,
    });
    expect(season).toEqual({ number: 2, startedAt: null });
  });

  it.each([
    ["a network error", jest.fn().mockRejectedValue(new Error("offline"))],
    ["a server error", reply(500)],
    ["a refusal", reply(403)],
    [
      "a double number",
      reply(200, { fields: { number: { doubleValue: 2.5 } } }),
    ],
    [
      "a string number",
      reply(200, { fields: { number: { stringValue: "2" } } }),
    ],
    [
      "a zero number",
      reply(200, { fields: { number: { integerValue: "0" } } }),
    ],
    ["no number", reply(200, { fields: {} })],
    ["a non-object reply", reply(200, "x")],
  ])("is null on %s", async (_label, fetchImpl) => {
    expect(
      await fetchSeason("plane", {
        config,
        fetchImpl,
        getAppCheckHeaders: noAppCheck,
      })
    ).toBeNull();
  });

  it("is null when Firebase is not configured", async () => {
    const fetchImpl = reply(404);
    expect(
      await fetchSeason("plane", {
        config: { ...config, apiKey: "" },
        fetchImpl,
      })
    ).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
