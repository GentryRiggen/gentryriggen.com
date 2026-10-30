import { canTrack, createGameTracker, type TrackEnv } from "../trackGame";
import type { GameEvent } from "../gameEvents";

const env: TrackEnv = {
  hostname: "gentryriggen.com",
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15",
  webdriver: false,
  isProduction: true,
  storage: null,
};

describe("createGameTracker flush", () => {
  it("passes the flush flag through to send", () => {
    const send = jest.fn();
    const track = createGameTracker({
      send,
      canSend: () => true,
      random: () => 0,
    });
    track("ship_shared", {});
    track("ship_shared", {}, true);
    expect(send.mock.calls.map((c) => c[1])).toEqual([false, true]);
  });
});

describe("canTrack", () => {
  it("tracks a normal production visitor", () => {
    expect(canTrack(env)).toBe(true);
  });
  it("skips dev builds, localhost, bots and the signed-in owner", () => {
    expect(canTrack({ ...env, isProduction: false })).toBe(false);
    expect(canTrack({ ...env, hostname: "localhost" })).toBe(false);
    expect(canTrack({ ...env, webdriver: true })).toBe(false);
    expect(canTrack({ ...env, userAgent: "Googlebot/2.1" })).toBe(false);
    expect(
      canTrack({
        ...env,
        storage: { getItem: () => "1", setItem: () => undefined },
      })
    ).toBe(false);
  });
});

describe("createGameTracker", () => {
  const props = { world: "meadow" } as const;

  it("sends a valid event", () => {
    const send = jest.fn();
    createGameTracker({ send, canSend: () => true })("world_unlocked", props);
    expect(send).toHaveBeenCalledTimes(1);
    expect((send.mock.calls[0][0] as GameEvent).name).toBe("world_unlocked");
  });

  it("sends nothing when tracking is off", () => {
    const send = jest.fn();
    createGameTracker({ send, canSend: () => false })("world_unlocked", props);
    expect(send).not.toHaveBeenCalled();
  });

  it("samples high-volume events", () => {
    const send = jest.fn();
    const random = jest.fn();
    const track = createGameTracker({ send, canSend: () => true, random });
    random.mockReturnValue(0.5);
    track("part_placed", { category: "decks" });
    expect(send).not.toHaveBeenCalled();
    random.mockReturnValue(0.01);
    track("part_placed", { category: "decks" });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("stops at the per-page-load cap", () => {
    const send = jest.fn();
    const track = createGameTracker({ send, canSend: () => true, cap: 3 });
    for (let i = 0; i < 10; i += 1) track("world_unlocked", props);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("does not spend the cap on events that were sampled out or invalid", () => {
    const send = jest.fn();
    const track = createGameTracker({
      send,
      canSend: () => true,
      random: () => 0.99,
      cap: 1,
    });
    track("part_placed", { category: "decks" });
    track("world_unlocked", { world: "nope" as never });
    track("world_unlocked", props);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("never throws, even if sending does", () => {
    const track = createGameTracker({
      send: () => {
        throw new Error("boom");
      },
      canSend: () => true,
    });
    expect(() => track("world_unlocked", props)).not.toThrow();
  });
});
