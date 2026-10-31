import {
  buildShipBoardQuery,
  fetchOwnShipEntry,
  fetchShipBoard,
  parseShipBoard,
  shipEntryFields,
  submitShipEntry,
} from "../shipBoard";

const config = {
  apiKey: "KEY",
  authDomain: "x",
  projectId: "proj",
  appId: "x",
};

const entry = {
  nickname: "Happy Otter 7",
  totalStars: 5,
  bests: { outlast: 170, evacuation: 50, shipshape: undefined },
};

describe("shipEntryFields", () => {
  it("encodes ints and a bests map, leaving out undefined bests", () => {
    expect(shipEntryFields(entry)).toEqual({
      nickname: { stringValue: "Happy Otter 7" },
      totalStars: { integerValue: "5" },
      bests: {
        mapValue: {
          fields: {
            outlast: { integerValue: "170" },
            evacuation: { integerValue: "50" },
          },
        },
      },
    });
  });
});

describe("submitShipEntry", () => {
  it("commits a full write of shipLeaderboard/{uid} with a server time", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true });
    const ok = await submitShipEntry(entry, 1, {
      config,
      fetchImpl,
      getSession: async () => ({ uid: "u1", idToken: "tok" }),
    });
    expect(ok).toBe("ok");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain(":commit?key=KEY");
    expect(init.headers.Authorization).toBe("Bearer tok");
    const write = JSON.parse(init.body).writes[0];
    expect(write.update.name).toBe(
      "projects/proj/databases/(default)/documents/shipLeaderboard/u1"
    );
    expect(write.updateTransforms).toEqual([
      { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" },
    ]);
    expect(write.currentDocument).toBeUndefined();
  });

  it("tells a refusal from a failure to deliver", async () => {
    const getSession = async () => ({ uid: "u1", idToken: "t" });
    expect(
      await submitShipEntry(entry, 1, { config, getSession: async () => null })
    ).toBe("error");
    expect(
      await submitShipEntry(entry, 1, {
        config,
        fetchImpl: jest.fn().mockResolvedValue({ ok: false, status: 403 }),
        getSession,
      })
    ).toBe("refused");
    expect(
      await submitShipEntry(entry, 1, {
        config,
        fetchImpl: jest.fn().mockResolvedValue({ ok: false, status: 503 }),
        getSession,
      })
    ).toBe("error");
    expect(
      await submitShipEntry(entry, 1, {
        config,
        fetchImpl: jest.fn().mockRejectedValue(new Error("offline")),
        getSession,
      })
    ).toBe("error");
  });
});

describe("the board", () => {
  const row = (uid: string, nickname: string, stars: number) => ({
    document: {
      name: `projects/proj/databases/(default)/documents/shipLeaderboard/${uid}`,
      fields: {
        nickname: { stringValue: nickname },
        totalStars: { integerValue: String(stars) },
      },
    },
  });

  it("asks for the top 50 by total stars", () => {
    expect(buildShipBoardQuery(1).structuredQuery).toEqual({
      from: [{ collectionId: "shipLeaderboard" }],
      orderBy: [
        { field: { fieldPath: "totalStars" }, direction: "DESCENDING" },
      ],
      limit: 50,
    });
  });

  it("parses rows and skips anything that is not a generated name", () => {
    const rows = parseShipBoard([
      row("a", "Happy Otter 7", 9),
      row("b", "<img src=x onerror=alert(1)>", 8),
      row("c", "Brave Fox 3", 4),
      {},
      { document: { name: "x" } },
    ]);
    expect(rows).toEqual([
      { uid: "a", nickname: "Happy Otter 7", value: 9 },
      { uid: "c", nickname: "Brave Fox 3", value: 4 },
    ]);
  });

  it("fetches without auth and gives null on failure", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [row("a", "Happy Otter 7", 9)],
    });
    expect(await fetchShipBoard(1, { config, fetchImpl })).toHaveLength(1);
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBeUndefined();
    expect(
      await fetchShipBoard(1, {
        config,
        fetchImpl: jest.fn().mockResolvedValue({ ok: false }),
      })
    ).toBeNull();
  });
});

describe("ship seasons", () => {
  const getSession = async () => ({ uid: "u1", idToken: "tok" });

  it("writes season 1 to shipLeaderboard and later seasons to shipSeasons/{n}/entries", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true });
    await submitShipEntry(entry, 1, { config, fetchImpl, getSession });
    await submitShipEntry(entry, 2, { config, fetchImpl, getSession });
    const names = fetchImpl.mock.calls.map(
      ([, init]) => JSON.parse(init.body).writes[0].update.name
    );
    expect(names).toEqual([
      "projects/proj/databases/(default)/documents/shipLeaderboard/u1",
      "projects/proj/databases/(default)/documents/shipSeasons/2/entries/u1",
    ]);
  });

  it("queries season 1 at the root and later seasons under their season doc", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => [] });
    await fetchShipBoard(1, { config, fetchImpl });
    await fetchShipBoard(2, { config, fetchImpl });
    const [[rootUrl, rootInit], [seasonUrl, seasonInit]] = fetchImpl.mock.calls;
    expect(rootUrl).toBe(
      "https://firestore.googleapis.com/v1/projects/proj/databases/(default)/documents:runQuery?key=KEY"
    );
    expect(JSON.parse(rootInit.body).structuredQuery.from).toEqual([
      { collectionId: "shipLeaderboard" },
    ]);
    expect(seasonUrl).toBe(
      "https://firestore.googleapis.com/v1/projects/proj/databases/(default)/documents/shipSeasons/2:runQuery?key=KEY"
    );
    expect(JSON.parse(seasonInit.body).structuredQuery.from).toEqual([
      { collectionId: "entries" },
    ]);
  });
});

describe("ship board App Check headers", () => {
  it("rides on the submit and the board read", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => [] });
    const deps = {
      config,
      fetchImpl,
      getSession: async () => ({ uid: "u1", idToken: "t" }),
      getAppCheckHeaders: async () => ({ "X-Firebase-AppCheck": "AC" }),
    };
    await submitShipEntry(entry, 1, deps);
    await fetchShipBoard(1, deps);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    for (const call of fetchImpl.mock.calls) {
      expect(call[1].headers["X-Firebase-AppCheck"]).toBe("AC");
    }
  });
});

describe("fetchOwnShipEntry", () => {
  const getSession = async () => ({ uid: "uid-1", idToken: "tok" });
  const doc = {
    name: "projects/proj/databases/(default)/documents/shipSeasons/2/entries/uid-1",
    fields: {
      nickname: { stringValue: "Brave Panda 3" },
      totalStars: { integerValue: "12" },
      bests: { mapValue: { fields: { outlast: { integerValue: "170" } } } },
      updatedAt: { timestampValue: "2026-10-30T12:00:00.000Z" },
    },
  };

  it("GETs the player's own doc in the season and parses it", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => doc });
    expect(
      await fetchOwnShipEntry(2, { config, fetchImpl, getSession })
    ).toEqual({
      nickname: "Brave Panda 3",
      totalStars: 12,
      updatedAt: Date.parse("2026-10-30T12:00:00.000Z"),
    });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(
      "https://firestore.googleapis.com/v1/projects/proj/databases/(default)/documents/shipSeasons/2/entries/uid-1?key=KEY"
    );
    expect(init.method).toBe("GET");
  });

  it("is 'missing' on a 404", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 404 });
    expect(await fetchOwnShipEntry(2, { config, fetchImpl, getSession })).toBe(
      "missing"
    );
  });

  it("is null on errors, junk, a bad name, no session or no config", async () => {
    const run = (deps: Parameters<typeof fetchOwnShipEntry>[1]) =>
      fetchOwnShipEntry(2, { config, getSession, ...deps });
    const replying = (json: unknown) =>
      jest.fn().mockResolvedValue({ ok: true, json: async () => json });
    expect(
      await run({
        fetchImpl: jest.fn().mockResolvedValue({ ok: false, status: 500 }),
      })
    ).toBeNull();
    expect(
      await run({ fetchImpl: jest.fn().mockRejectedValue(new Error("x")) })
    ).toBeNull();
    expect(await run({ fetchImpl: replying({ fields: {} }) })).toBeNull();
    expect(
      await run({
        fetchImpl: replying({
          fields: { ...doc.fields, nickname: { stringValue: "<b>" } },
        }),
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
