import {
  clearParamsFromLocation,
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
      reflect: false,
    });
  });

  it("reads a reflect request", () => {
    const open = parseOpen("/jim/chat?reflect=1", ORIGIN);
    expect(open?.route).toEqual({ kind: "chat" });
    expect(open?.reflect).toBe(true);
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
    expect(open?.reflect).toBe(false);
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
    emitOpenIntent({ listen: "brief", reflect: false });
    const first = jest.fn();
    const off = onOpenIntent(first);
    expect(first).toHaveBeenCalledWith({ listen: "brief", reflect: false });
    off();
    const second = jest.fn();
    const off2 = onOpenIntent(second);
    expect(second).not.toHaveBeenCalled();
    off2();
  });

  it("delivers to a subscriber and ignores an empty intent", () => {
    const listener = jest.fn();
    const off = onOpenIntent(listener);
    emitOpenIntent({ listen: null, reflect: false });
    emitOpenIntent({ listen: null, reflect: true });
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });
});
