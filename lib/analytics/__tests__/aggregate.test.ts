import { pctChange, summarize } from "../aggregate";
import type { PageviewDoc } from "../types";

const NOW = new Date("2026-10-07T12:00:00Z");

function view(ts: string, overrides: Partial<PageviewDoc> = {}): PageviewDoc {
  return {
    ts: new Date(ts),
    site: "home",
    path: "/",
    ref: "",
    device: "desktop",
    browser: "Chrome",
    os: "macOS",
    screen: "1440+",
    tz: "America/Denver",
    vid: "visitor-a",
    ...overrides,
  };
}

describe("summarize totals", () => {
  it("counts views and daily-unique visitors", () => {
    const docs = [
      view("2026-10-07T01:00:00Z", { vid: "a" }),
      view("2026-10-07T02:00:00Z", { vid: "a" }),
      view("2026-10-07T03:00:00Z", { vid: "b" }),
      view("2026-10-06T03:00:00Z", { vid: "a" }),
    ];
    const s = summarize(docs, { site: "all", days: 7, now: NOW });
    expect(s.totals).toEqual({ views: 4, visitors: 3 });
  });

  it("filters by site", () => {
    const docs = [
      view("2026-10-07T01:00:00Z", { site: "home" }),
      view("2026-10-07T01:00:00Z", { site: "ship-builder", vid: "b" }),
    ];
    expect(
      summarize(docs, { site: "home", days: 7, now: NOW }).totals.views
    ).toBe(1);
    expect(
      summarize(docs, { site: "ship-builder", days: 7, now: NOW }).totals.views
    ).toBe(1);
    expect(
      summarize(docs, { site: "all", days: 7, now: NOW }).totals.views
    ).toBe(2);
  });

  it("splits the current and previous windows", () => {
    const docs = [
      view("2026-10-07T01:00:00Z"), // current (window 10-01..10-07)
      view("2026-10-01T00:00:00Z"), // current, first instant
      view("2026-09-30T23:59:59Z"), // previous
      view("2026-09-24T00:00:00Z"), // previous, first instant
      view("2026-09-23T23:59:59Z"), // outside both
      view("2026-10-08T00:00:00Z"), // future, outside
    ];
    const s = summarize(docs, { site: "all", days: 7, now: NOW });
    expect(s.totals.views).toBe(2);
    expect(s.previous.views).toBe(2);
  });
});

describe("summarize series", () => {
  it("has one zero-filled point per day, oldest first", () => {
    const docs = [view("2026-10-07T01:00:00Z"), view("2026-10-05T01:00:00Z")];
    const { series } = summarize(docs, { site: "all", days: 7, now: NOW });
    expect(series.map((p) => p.date)).toEqual([
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
    ]);
    expect(series.map((p) => p.views)).toEqual([0, 0, 0, 0, 1, 0, 1]);
  });
});

describe("summarize breakdowns", () => {
  it("sorts by views then key and labels empty referrers", () => {
    const docs = [
      view("2026-10-07T01:00:00Z", { ref: "" }),
      view("2026-10-07T01:00:00Z", { ref: "" }),
      view("2026-10-07T01:00:00Z", { ref: "b.com" }),
      view("2026-10-07T01:00:00Z", { ref: "a.com" }),
    ];
    const { breakdowns } = summarize(docs, { site: "all", days: 7, now: NOW });
    expect(breakdowns.referrers).toEqual([
      { key: "(direct)", views: 2 },
      { key: "a.com", views: 1 },
      { key: "b.com", views: 1 },
    ]);
  });

  it("caps each list at 8 entries", () => {
    const docs = Array.from({ length: 12 }, (_, i) =>
      view("2026-10-07T01:00:00Z", { path: `/p${i}` })
    );
    const { breakdowns } = summarize(docs, { site: "all", days: 7, now: NOW });
    expect(breakdowns.paths).toHaveLength(8);
  });

  it("covers devices, browsers, systems and screens", () => {
    const docs = [
      view("2026-10-07T01:00:00Z", { device: "mobile", os: "iOS" }),
    ];
    const { breakdowns } = summarize(docs, { site: "all", days: 7, now: NOW });
    expect(breakdowns.devices).toEqual([{ key: "mobile", views: 1 }]);
    expect(breakdowns.systems).toEqual([{ key: "iOS", views: 1 }]);
    expect(breakdowns.browsers).toEqual([{ key: "Chrome", views: 1 }]);
    expect(breakdowns.screens).toEqual([{ key: "1440+", views: 1 }]);
  });
});

describe("summarize places", () => {
  it("groups by timezone with views and daily visitors", () => {
    const docs = [
      view("2026-10-07T01:00:00Z", { tz: "Europe/Paris", vid: "a" }),
      view("2026-10-07T02:00:00Z", { tz: "Europe/Paris", vid: "a" }),
      view("2026-10-07T03:00:00Z", { tz: "Asia/Tokyo", vid: "b" }),
    ];
    const { places } = summarize(docs, { site: "all", days: 7, now: NOW });
    expect(places).toEqual([
      { tz: "Europe/Paris", views: 2, visitors: 1 },
      { tz: "Asia/Tokyo", views: 1, visitors: 1 },
    ]);
  });
});

describe("pctChange", () => {
  it("is null when there is no previous value", () => {
    expect(pctChange(5, 0)).toBeNull();
  });

  it("rounds the percentage change", () => {
    expect(pctChange(15, 10)).toBe(50);
    expect(pctChange(5, 10)).toBe(-50);
    expect(pctChange(10, 10)).toBe(0);
  });
});
