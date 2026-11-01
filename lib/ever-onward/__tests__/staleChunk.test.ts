import {
  RELOAD_STAMP_KEY,
  RELOAD_WINDOW_MS,
  claimReload,
  isAppScriptLoadFailure,
  isChunkLoadFailure,
} from "../staleChunk";

describe("isChunkLoadFailure", () => {
  it.each([
    new Error("Loading chunk 123 failed."),
    Object.assign(new Error("boom"), { name: "ChunkLoadError" }),
    new TypeError("Failed to fetch dynamically imported module: /x.js"),
    "Importing a module script failed.",
  ])("matches %s", (reason) => {
    expect(isChunkLoadFailure(reason)).toBe(true);
  });

  it.each([new Error("Cannot read properties of undefined"), null, 42, "nope"])(
    "ignores %s",
    (reason) => {
      expect(isChunkLoadFailure(reason)).toBe(false);
    }
  );
});

describe("isAppScriptLoadFailure", () => {
  it("only matches the app's own scripts", () => {
    const own = document.createElement("script");
    own.src = "http://localhost/_next/static/chunks/a.js";
    const other = document.createElement("script");
    other.src = "https://example.com/ads.js";
    expect(isAppScriptLoadFailure(own)).toBe(true);
    expect(isAppScriptLoadFailure(other)).toBe(false);
    expect(isAppScriptLoadFailure(document.createElement("div"))).toBe(false);
  });
});

describe("claimReload", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("allows one reload a minute", () => {
    expect(claimReload(window.sessionStorage, 1_000_000)).toBe(true);
    expect(claimReload(window.sessionStorage, 1_000_000 + 5_000)).toBe(false);
    expect(
      claimReload(window.sessionStorage, 1_000_000 + RELOAD_WINDOW_MS)
    ).toBe(true);
  });

  it("refuses when storage fails, so it can never loop", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => undefined,
    } as unknown as Storage;
    expect(claimReload(broken, 1)).toBe(false);
    expect(window.sessionStorage.getItem(RELOAD_STAMP_KEY)).toBeNull();
  });
});
