import {
  claimOpen,
  clearParamsFromLocation,
  consumePendingOpen,
  emitOpenIntent,
  onOpenIntent,
  parseOpen,
} from "../openUrl";

const ORIGIN = "https://app.example.test";

describe("parseOpen", () => {
  it("reads a listen request as chat", () => {
    expect(parseOpen("/jim?listen=brief", ORIGIN)).toEqual({
      route: { kind: "chat" },
      say: null,
      listen: "brief",
    });
  });

  it("sends an old ?reflect=1 link to the evening retro", () => {
    for (const url of ["/jim/chat?reflect=1", "/jim?reflect=1"]) {
      expect(parseOpen(url, ORIGIN)?.route).toEqual({
        kind: "retro",
        retro: "evening",
      });
    }
  });

  it("reads the retro addresses", () => {
    expect(parseOpen("/jim/retro/morning", ORIGIN)?.route).toEqual({
      kind: "retro",
      retro: "morning",
    });
    expect(parseOpen(`${ORIGIN}/jim/retro/evening`, ORIGIN)?.route).toEqual({
      kind: "retro",
      retro: "evening",
    });
  });

  it("reads a reminder and a meeting", () => {
    expect(
      parseOpen(`${ORIGIN}/jim/reminders/abcdef012345`, ORIGIN)?.route
    ).toEqual({
      kind: "reminder",
      id: "abcdef012345",
    });
    expect(parseOpen("/jim/meeting/0123456789abcdef", ORIGIN)?.route).toEqual({
      kind: "meeting",
      id: "0123456789abcdef",
    });
  });

  it("allows only the say texts on the list", () => {
    expect(parseOpen("/jim?say=quiz%20me", ORIGIN)?.say).toBe("quiz me");
    expect(parseOpen("/jim?say=anything%20else", ORIGIN)?.say).toBeNull();
  });

  it("ignores unknown listen and reflect values", () => {
    const open = parseOpen("/jim?listen=other&reflect=yes", ORIGIN);
    expect(open?.listen).toBeNull();
    expect(open?.route).toEqual({ kind: "chat" });
  });

  it.each([
    "https://evil.example/jim",
    "//evil.example/jim",
    "/other",
    "/jimmy",
    "javascript:alert(1)",
    "",
  ])("returns null for %p", (url) => {
    expect(parseOpen(url, ORIGIN)).toBeNull();
  });
});

describe("clearParamsFromLocation", () => {
  it("drops only the named params", () => {
    window.history.replaceState(null, "", "/jim?listen=brief&keep=1&say=x");
    clearParamsFromLocation(["listen", "say", "reflect"]);
    expect(window.location.search).toBe("?keep=1");
  });

  it("leaves the address alone when none are present", () => {
    window.history.replaceState({ a: 1 }, "", "/jim?keep=1");
    clearParamsFromLocation(["listen"]);
    expect(window.location.search).toBe("?keep=1");
    expect(window.history.state).toEqual({ a: 1 });
  });
});

describe("open intents", () => {
  it("holds an intent until someone subscribes, once", () => {
    emitOpenIntent({ listen: "brief" });
    const first = jest.fn();
    const off = onOpenIntent(first);
    expect(first).toHaveBeenCalledWith({ listen: "brief" });
    off();
    const second = jest.fn();
    const off2 = onOpenIntent(second);
    expect(second).not.toHaveBeenCalled();
    off2();
  });

  it("delivers to a subscriber and ignores an empty intent", () => {
    const listener = jest.fn();
    const off = onOpenIntent(listener);
    emitOpenIntent({ listen: null });
    emitOpenIntent({ listen: "brief" });
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });
});

describe("the pending-open note a tap leaves", () => {
  const KEY = "/jim/__open";
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    Object.defineProperty(window, "caches", {
      configurable: true,
      value: {
        open: async (name: string) => {
          expect(name).toBe("jim-open-v1");
          return {
            match: async (key: string) => {
              const body = store.get(key);
              return body === undefined
                ? undefined
                : { text: async () => body };
            },
            delete: async (key: string) => store.delete(key),
          };
        },
      },
    });
  });
  afterEach(() => {
    Reflect.deleteProperty(window, "caches");
  });

  function leave(id: string, url: string, at: number) {
    store.set(KEY, JSON.stringify({ id, url, at }));
  }

  it("returns a fresh note's url once, and deletes it", async () => {
    leave("tap-fresh", "/jim/retro/evening", 1_000_000);
    await expect(consumePendingOpen(1_000_000 + 119_000)).resolves.toBe(
      "/jim/retro/evening"
    );
    expect(store.has(KEY)).toBe(false);
    await expect(consumePendingOpen(1_000_000 + 119_000)).resolves.toBeNull();
  });

  it("drops a stale note (over 120 s) and deletes it", async () => {
    leave("tap-stale", "/jim/retro/evening", 1_000_000);
    await expect(consumePendingOpen(1_000_000 + 121_000)).resolves.toBeNull();
    expect(store.has(KEY)).toBe(false);
  });

  it("drops a note from the future and one that isn't a note", async () => {
    leave("tap-future", "/jim/retro/evening", 2_000_000);
    await expect(consumePendingOpen(1_000_000)).resolves.toBeNull();
    store.set(KEY, "not json{");
    await expect(consumePendingOpen(1_000_000)).resolves.toBeNull();
    expect(store.has(KEY)).toBe(false);
    store.set(KEY, JSON.stringify({ id: 4, url: "/jim", at: 1_000_000 }));
    await expect(consumePendingOpen(1_000_000)).resolves.toBeNull();
  });

  it("handles a tap seen by message and then by its note once", async () => {
    expect(claimOpen("tap-both")).toBe(true);
    leave("tap-both", "/jim/retro/evening", 1_000_000);
    await expect(consumePendingOpen(1_000_000)).resolves.toBeNull();
    expect(store.has(KEY)).toBe(false);
  });

  it("handles a tap seen by its note and then by message once", async () => {
    leave("tap-note-first", "/jim/retro/morning", 1_000_000);
    await expect(consumePendingOpen(1_000_000)).resolves.toBe(
      "/jim/retro/morning"
    );
    expect(claimOpen("tap-note-first")).toBe(false);
  });

  it("is null with nothing left, or no cache storage", async () => {
    await expect(consumePendingOpen(1_000_000)).resolves.toBeNull();
    Reflect.deleteProperty(window, "caches");
    await expect(consumePendingOpen(1_000_000)).resolves.toBeNull();
  });
});

describe("claimOpen", () => {
  it("is true the first time for an id, then false", () => {
    expect(claimOpen("tap-claim")).toBe(true);
    expect(claimOpen("tap-claim")).toBe(false);
  });

  it("always lets a message without an id through (an older worker)", () => {
    expect(claimOpen(undefined)).toBe(true);
    expect(claimOpen(undefined)).toBe(true);
  });
});
