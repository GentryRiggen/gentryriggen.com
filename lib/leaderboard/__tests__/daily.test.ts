import {
  buildDailyQuery,
  buildDailySubmitBody,
  dailyCommitUrl,
  dailyRunQueryUrl,
  fetchDailyBoard,
  parseDailyBoard,
  submitDaily,
} from "../daily";
import type { DailyEntry } from "../daily";

const config = {
  apiKey: "KEY",
  authDomain: "x",
  projectId: "proj",
  appId: "x",
};
const entry: DailyEntry = {
  nickname: "Happy Otter 7",
  world: "city",
  time: 71.4,
};
const session = async () => ({ uid: "u1", idToken: "TOKEN" });

describe("daily request building", () => {
  it("writes planeDaily/{date}/entries/{uid} with a server updatedAt", () => {
    expect(buildDailySubmitBody("proj", "2026-10-30", "u1", entry)).toEqual({
      writes: [
        {
          update: {
            name: "projects/proj/databases/(default)/documents/planeDaily/2026-10-30/entries/u1",
            fields: {
              nickname: { stringValue: "Happy Otter 7" },
              world: { stringValue: "city" },
              time: { doubleValue: 71.4 },
            },
          },
          updateTransforms: [
            { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" },
          ],
        },
      ],
    });
  });

  it("queries the day's entries, fastest first, 20 at most", () => {
    expect(buildDailyQuery().structuredQuery).toEqual({
      from: [{ collectionId: "entries" }],
      orderBy: [{ field: { fieldPath: "time" }, direction: "ASCENDING" }],
      limit: 20,
    });
    expect(dailyRunQueryUrl(config, "2026-10-30", "http://h")).toBe(
      "http://h/v1/projects/proj/databases/(default)/documents/planeDaily/2026-10-30:runQuery?key=KEY"
    );
    expect(dailyCommitUrl(config, "http://h")).toContain(":commit?key=KEY");
  });
});

describe("parseDailyBoard", () => {
  it("reads rows and skips damaged ones", () => {
    const doc = (uid: string, fields: Record<string, unknown>) => ({
      document: {
        name: `projects/p/databases/(default)/documents/planeDaily/d/entries/${uid}`,
        fields,
      },
    });
    const rows = parseDailyBoard([
      doc("a", { nickname: { stringValue: "A" }, time: { doubleValue: 50.5 } }),
      doc("b", {
        nickname: { stringValue: "B" },
        time: { integerValue: "60" },
      }),
      doc("c", { nickname: { stringValue: "C" } }),
      doc("d", { time: { doubleValue: 1 } }),
      {},
    ]);
    expect(rows).toEqual([
      { uid: "a", nickname: "A", value: 50.5 },
      { uid: "b", nickname: "B", value: 60 },
    ]);
  });

  it("returns nothing for a non-array answer", () => {
    expect(parseDailyBoard({ error: "x" })).toEqual([]);
  });
});

describe("submitDaily and fetchDailyBoard", () => {
  it("sends the signed commit and reports success", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true });
    const ok = await submitDaily("2026-10-30", entry, {
      config,
      fetchImpl,
      getSession: session,
    });
    expect(ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain(":commit");
    expect(init.headers.Authorization).toBe("Bearer TOKEN");
  });

  it("never throws, and refuses a malformed date", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error("offline"));
    expect(
      await submitDaily("2026-10-30", entry, {
        config,
        fetchImpl,
        getSession: session,
      })
    ).toBe(false);
    expect(
      await submitDaily("../leaderboard", entry, {
        config,
        fetchImpl,
        getSession: session,
      })
    ).toBe(false);
    expect(await fetchDailyBoard("../x", { config, fetchImpl })).toBeNull();
  });

  it("returns null when the board fails to load", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false });
    expect(
      await fetchDailyBoard("2026-10-30", { config, fetchImpl })
    ).toBeNull();
  });
});
