import {
  buildShipBoardQuery,
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
    const ok = await submitShipEntry(entry, {
      config,
      fetchImpl,
      getSession: async () => ({ uid: "u1", idToken: "tok" }),
    });
    expect(ok).toBe(true);
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

  it("is false without a session or on a rejected write", async () => {
    expect(
      await submitShipEntry(entry, { config, getSession: async () => null })
    ).toBe(false);
    expect(
      await submitShipEntry(entry, {
        config,
        fetchImpl: jest.fn().mockResolvedValue({ ok: false }),
        getSession: async () => ({ uid: "u1", idToken: "t" }),
      })
    ).toBe(false);
    expect(
      await submitShipEntry(entry, {
        config,
        fetchImpl: jest.fn().mockRejectedValue(new Error("offline")),
        getSession: async () => ({ uid: "u1", idToken: "t" }),
      })
    ).toBe(false);
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
    expect(buildShipBoardQuery().structuredQuery).toEqual({
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
    expect(await fetchShipBoard({ config, fetchImpl })).toHaveLength(1);
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBeUndefined();
    expect(
      await fetchShipBoard({
        config,
        fetchImpl: jest.fn().mockResolvedValue({ ok: false }),
      })
    ).toBeNull();
  });
});
