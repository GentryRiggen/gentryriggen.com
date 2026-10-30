import type { GameEvent } from "../gameEvents";
import { buildGameCommitBody, newDocId, sendGameEvent } from "../gameSend";

const event: GameEvent = {
  site: "plane-builder",
  name: "flight_end",
  props: { world: "meadow", dist: 3 },
  day: "2026-10-30",
};
const config = {
  apiKey: "KEY",
  authDomain: "x",
  projectId: "proj",
  appId: "1:2:web:3",
};

describe("buildGameCommitBody", () => {
  const write = buildGameCommitBody("proj", "d1", event).writes[0];

  it("creates a gameEvents doc with typed props", () => {
    expect(write.update.name).toBe(
      "projects/proj/databases/(default)/documents/gameEvents/d1"
    );
    expect(write.currentDocument).toEqual({ exists: false });
    expect(write.update.fields.props).toEqual({
      mapValue: {
        fields: {
          world: { stringValue: "meadow" },
          dist: { integerValue: "3" },
        },
      },
    });
    expect(write.update.fields.day).toEqual({ stringValue: "2026-10-30" });
  });

  it("stamps createdAt as the start of the event's UTC day, no server time", () => {
    expect(write.update.fields.createdAt).toEqual({
      timestampValue: "2026-10-30T00:00:00Z",
    });
    expect(write).not.toHaveProperty("updateTransforms");
  });
});

describe("newDocId", () => {
  const UUID_V4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it("is a UUIDv4", () => {
    expect(newDocId()).toMatch(UUID_V4);
  });

  it("falls back to a random UUIDv4 with no clock in it", () => {
    const original = globalThis.crypto.randomUUID;
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    });
    const now = jest.spyOn(Date, "now");
    try {
      const ids = new Set(Array.from({ length: 200 }, newDocId));
      for (const id of ids) expect(id).toMatch(UUID_V4);
      expect(ids.size).toBe(200);
      expect(now).not.toHaveBeenCalled();
    } finally {
      now.mockRestore();
      Object.defineProperty(globalThis.crypto, "randomUUID", {
        value: original,
        configurable: true,
      });
    }
  });
});

describe("sendGameEvent", () => {
  it("posts with keepalive so it survives the page closing", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true });
    await expect(sendGameEvent(event, { config, fetchImpl })).resolves.toBe(
      true
    );
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.keepalive).toBe(true);
    expect(init.method).toBe("POST");
  });

  it("drops silently on failure", async () => {
    const rejects = jest.fn().mockRejectedValue(new Error("offline"));
    await expect(
      sendGameEvent(event, { config, fetchImpl: rejects })
    ).resolves.toBe(false);
    const refused = jest.fn().mockResolvedValue({ ok: false });
    await expect(
      sendGameEvent(event, { config, fetchImpl: refused })
    ).resolves.toBe(false);
  });

  it("does nothing without a Firebase config", async () => {
    const fetchImpl = jest.fn();
    await expect(
      sendGameEvent(event, { config: { ...config, apiKey: "" }, fetchImpl })
    ).resolves.toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
