import { LEVEL_ORDER } from "@/lib/plane-builder/levels";
import { TRACK_IDS } from "@/lib/plane-builder/plane/catalog";
import { SHIP_KINDS } from "@/lib/ship-builder/model/kinds";
import { TEMPLATES } from "@/lib/ship-builder/templates";
import { OBSTACLE_KINDS as DRIVE_KINDS } from "@/lib/ship-builder/sail/driveConfig";
import {
  GAME_EVENTS,
  TEMPLATE_IDS,
  buildGameEvent,
  isTemplateId,
  crashBucket,
  isValidGameProps,
  parseGameEvent,
  tenths,
} from "../gameEvents";

describe("trial_run", () => {
  it("accepts the storm kind and the wild sea, and nothing else new", () => {
    const base = { kind: "storm", outcome: "sank", sea: "wild" };
    expect(isValidGameProps("trial_run", base)).toBe(true);
    expect(isValidGameProps("trial_run", { ...base, kind: "tornado" })).toBe(
      false
    );
    expect(isValidGameProps("trial_run", { ...base, sea: "tsunami" })).toBe(
      false
    );
  });
});

describe("schema stays in step with the games", () => {
  it("lists every world, in order", () => {
    expect([...GAME_EVENTS.flight_end.props.world.values]).toEqual([
      ...LEVEL_ORDER,
    ]);
  });
  it("lists every upgrade track", () => {
    expect([...GAME_EVENTS.upgrade_bought.props.part.values]).toEqual([
      ...TRACK_IDS,
    ]);
  });
  it("accepts every template id and the list equals the registry", () => {
    const ids = Object.values(TEMPLATES)
      .flat()
      .map((t) => t.id);
    expect([...TEMPLATE_IDS].sort()).toEqual([...ids].sort());
    for (const template of ids) {
      expect(isValidGameProps("template_used", { template })).toBe(true);
    }
  });
  it("rejects any template id that is not built in (no free text)", () => {
    for (const template of [
      "jane-doe-age-9-lives-on-elm-st",
      "titanic2",
      "Titanic",
      "",
    ]) {
      expect(isValidGameProps("template_used", { template })).toBe(false);
    }
    expect(isTemplateId("titanic")).toBe(true);
    expect(isTemplateId("jane-doe")).toBe(false);
  });
  it("has a ship kind list the dashboard can rely on", () => {
    expect(SHIP_KINDS.length).toBeGreaterThan(0);
    expect(DRIVE_KINDS.length).toBeGreaterThan(0);
  });
});

describe("buildGameEvent", () => {
  const props = {
    world: "meadow",
    outcome: "crash",
    dist: 4,
    crashX: 850,
    obstacle: "tree",
    tiers: 7,
    daily: 0,
  } as const;

  it("stamps the site and the UTC day", () => {
    const event = buildGameEvent(
      "flight_end",
      props,
      new Date("2026-10-30T23:59:59Z")
    );
    expect(event).toEqual({
      site: "plane-builder",
      name: "flight_end",
      props,
      day: "2026-10-30",
    });
  });

  it("refuses props that break the schema", () => {
    expect(buildGameEvent("flight_end", { ...props, crashX: 851 })).toBeNull();
    expect(buildGameEvent("flight_end", { ...props, dist: 11 })).toBeNull();
    expect(buildGameEvent("flight_end", { ...props, dist: 2.5 })).toBeNull();
    expect(buildGameEvent("flight_end", { ...props, tiers: NaN })).toBeNull();
  });
});

describe("isValidGameProps", () => {
  it("rejects extras, gaps and prototype tricks", () => {
    const ok = { world: "meadow" };
    expect(isValidGameProps("world_unlocked", ok)).toBe(true);
    expect(isValidGameProps("world_unlocked", { ...ok, note: "x" })).toBe(
      false
    );
    expect(isValidGameProps("world_unlocked", {})).toBe(false);
    expect(isValidGameProps("world_unlocked", null)).toBe(false);
    expect(isValidGameProps("toString", {})).toBe(false);
    expect(isValidGameProps("world_unlocked", { world: "__proto__" })).toBe(
      false
    );
  });
  it("allows ship_shared only with no props", () => {
    expect(isValidGameProps("ship_shared", {})).toBe(true);
    expect(isValidGameProps("ship_shared", { a: 1 })).toBe(false);
  });
});

describe("parseGameEvent", () => {
  it("keeps a good doc and drops a doctored one", () => {
    const good = {
      site: "ship-builder",
      name: "walk_started",
      props: { start: "bow" },
      day: "2026-10-30",
    };
    expect(parseGameEvent(good)).toEqual(good);
    expect(parseGameEvent({ ...good, site: "plane-builder" })).toBeNull();
    expect(
      parseGameEvent({ ...good, props: { start: "<b>x</b>" } })
    ).toBeNull();
    expect(parseGameEvent({ ...good, day: "yesterday" })).toBeNull();
    expect(parseGameEvent({ ...good, name: "nope" })).toBeNull();
  });
});

describe("bucketing", () => {
  it("buckets crashes to 50 m and flags non-crashes", () => {
    expect(crashBucket(0)).toBe(0);
    expect(crashBucket(49.9)).toBe(0);
    expect(crashBucket(1234)).toBe(1200);
    expect(crashBucket(null)).toBe(-1);
    expect(crashBucket(NaN)).toBe(-1);
    expect(crashBucket(1e9)).toBe(12000);
  });
  it("buckets distance to tenths of the course", () => {
    expect(tenths(0, 2000)).toBe(0);
    expect(tenths(999, 2000)).toBe(4);
    expect(tenths(2000, 2000)).toBe(10);
    expect(tenths(5000, 2000)).toBe(10);
    expect(tenths(10, 0)).toBe(0);
  });
});
