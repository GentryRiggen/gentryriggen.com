import { buildPageview, type PageviewEnv } from "../event";

const CHROME_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function env(overrides: Partial<PageviewEnv> = {}): PageviewEnv {
  return {
    pathname: "/",
    hostname: "gentryriggen.com",
    referrer: "https://www.google.com/search?q=x",
    userAgent: CHROME_WIN,
    webdriver: false,
    maxTouchPoints: 0,
    screenWidth: 1920,
    timeZone: "America/Denver",
    isProduction: true,
    storage: null,
    firstView: true,
    now: new Date("2026-10-07T12:00:00Z"),
    ...overrides,
  };
}

describe("buildPageview", () => {
  it("builds the event", () => {
    const e = buildPageview(env());
    expect(e).toMatchObject({
      site: "home",
      path: "/",
      ref: "google.com",
      device: "desktop",
      browser: "Chrome",
      os: "Windows",
      screen: "1440+",
      tz: "America/Denver",
    });
    expect(e?.vid.length).toBeGreaterThanOrEqual(8);
  });

  it("classifies ship builder paths", () => {
    expect(
      buildPageview(env({ pathname: "/ship-builder/versions" }))?.site
    ).toBe("ship-builder");
  });

  it("returns null outside production", () => {
    expect(buildPageview(env({ isProduction: false }))).toBeNull();
  });

  it.each(["localhost", "127.0.0.1", "::1"])(
    "returns null on %s",
    (hostname) => {
      expect(buildPageview(env({ hostname }))).toBeNull();
    }
  );

  it("returns null for untracked paths, bots and excluded browsers", () => {
    expect(buildPageview(env({ pathname: "/admin" }))).toBeNull();
    expect(buildPageview(env({ webdriver: true }))).toBeNull();
    const storage = {
      getItem: (k: string) => (k === "analytics-exclude" ? "1" : null),
      setItem: () => {},
    };
    expect(buildPageview(env({ storage }))).toBeNull();
  });

  it("drops the referrer after the first view and for the same host", () => {
    expect(buildPageview(env({ firstView: false }))?.ref).toBe("");
    expect(
      buildPageview(env({ referrer: "https://gentryriggen.com/x" }))?.ref
    ).toBe("");
    expect(
      buildPageview(env({ referrer: "https://www.gentryriggen.com/" }))?.ref
    ).toBe("");
    expect(buildPageview(env({ referrer: "not a url" }))?.ref).toBe("");
  });
});
