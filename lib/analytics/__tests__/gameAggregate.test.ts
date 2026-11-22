import type { GameEvent } from "../gameEvents";
import {
  summarizeFlamelings,
  summarizePlane,
  summarizeShip,
  summarizeShipwreck,
} from "../gameAggregate";

function plane(name: GameEvent["name"], props: GameEvent["props"]): GameEvent {
  return { site: "plane-builder", name, props, day: "2026-10-30" };
}
function ship(name: GameEvent["name"], props: GameEvent["props"]): GameEvent {
  return { site: "ship-builder", name, props, day: "2026-10-30" };
}
function end(over: Record<string, string | number>) {
  return plane("flight_end", {
    world: "meadow",
    outcome: "crash",
    dist: 3,
    crashX: 100,
    obstacle: "tree",
    tiers: 2,
    daily: 0,
    ...over,
  });
}

describe("summarizePlane", () => {
  const events = [
    end({}),
    end({ crashX: 100 }),
    end({ crashX: 250, obstacle: "barn" }),
    end({ outcome: "finish", crashX: -1, obstacle: "none", dist: 10 }),
    end({ world: "canyon", outcome: "timeout", crashX: -1, obstacle: "none" }),
    plane("quit_mid_flight", { world: "meadow", dist: 2 }),
    plane("upgrade_bought", { part: "wings", tier: 1 }),
    plane("upgrade_bought", { part: "wings", tier: 2 }),
    plane("world_unlocked", { world: "canyon" }),
    plane("daily_played", { world: "meadow", twist: "tailwind", finished: 1 }),
    plane("daily_played", { world: "meadow", twist: "tailwind", finished: 0 }),
  ];
  const summary = summarizePlane(events);
  const meadow = summary.worlds[0];

  it("counts flights and the finish rate per world", () => {
    expect(summary.flights).toBe(5);
    expect(meadow.flights).toBe(4);
    expect(meadow.finishes).toBe(1);
    expect(meadow.finishRate).toBe(0.25);
    expect(summary.worlds[1].finishRate).toBe(0);
    expect(summary.worlds[2].finishRate).toBeNull();
  });

  it("builds a crash bar for every 50 m up to the farthest crash", () => {
    expect(meadow.crashes).toBe(3);
    expect(meadow.crashBars.map((b) => b.x)).toEqual([
      0, 50, 100, 150, 200, 250,
    ]);
    expect(meadow.crashBars.map((b) => b.crashes)).toEqual([0, 0, 2, 0, 0, 1]);
  });

  it("ranks the obstacles that were hit, ignoring non-crashes", () => {
    expect(summary.obstacles).toEqual([
      { key: "tree", views: 2 },
      { key: "barn", views: 1 },
    ]);
    expect(meadow.obstacles[0]).toEqual({ key: "tree", views: 2 });
  });

  it("places quits by tenth of the course", () => {
    expect(meadow.quits).toBe(1);
    expect(meadow.quitsByTenth[2]).toBe(1);
  });

  it("tallies upgrades, unlocks and the daily", () => {
    expect(summary.upgrades).toEqual([{ key: "wings", views: 2 }]);
    expect(summary.unlocks).toEqual([{ key: "canyon", views: 1 }]);
    expect(summary.dailyPlayed).toBe(2);
    expect(summary.dailyFinished).toBe(1);
  });

  it("handles no events", () => {
    const empty = summarizePlane([]);
    expect(empty.flights).toBe(0);
    expect(empty.worlds[0].crashBars).toEqual([]);
  });
});

describe("summarizeShip", () => {
  const summary = summarizeShip([
    ship("trial_run", { kind: "iceberg", outcome: "sank", sea: "calm" }),
    ship("trial_run", { kind: "iceberg", outcome: "sank", sea: "calm" }),
    ship("trial_run", { kind: "weather", outcome: "steady", sea: "stormy" }),
    ship("challenge_result", { id: "outlast", stars: 1 }),
    ship("challenge_result", { id: "outlast", stars: 3 }),
    ship("template_used", { template: "titanic" }),
    ship("part_placed", { category: "decks" }),
    ship("walk_started", { start: "bow" }),
    ship("escape_ending", { ending: "deck", boat: "davit" }),
    ship("escape_ending", { ending: "deck", boat: "davit" }),
    ship("escape_ending", { ending: "deck", boat: "raft" }),
    ship("escape_ending", { ending: "frozen", boat: "none" }),
    ship("drive_started", { density: "few" }),
    ship("ship_shared", {}),
  ]);

  it("counts trial outcomes by kind", () => {
    expect(summary.trials).toBe(3);
    expect(summary.trialOutcomes[0]).toEqual({
      key: "iceberg: sank",
      views: 2,
    });
  });

  it("tallies how walkers escaped", () => {
    expect(summary.escapes).toEqual([
      { key: "deck · davit", views: 2 },
      { key: "deck · raft", views: 1 },
      { key: "frozen · none", views: 1 },
    ]);
  });

  it("builds a star distribution per challenge", () => {
    const outlast = summary.challenges.find((c) => c.id === "outlast");
    expect(outlast).toEqual({ id: "outlast", stars: [0, 1, 0, 1], results: 2 });
  });

  it("counts templates, parts and modes", () => {
    expect(summary.templates).toEqual([{ key: "titanic", views: 1 }]);
    expect(summary.partCategories).toEqual([{ key: "decks", views: 1 }]);
    expect([summary.walks, summary.drives, summary.shares]).toEqual([1, 1, 1]);
  });
});

describe("summarizeFlamelings", () => {
  const fl = (
    name: GameEvent["name"],
    props: GameEvent["props"]
  ): GameEvent => ({
    site: "flamelings",
    name,
    props,
    day: "2026-11-16",
  });
  const events = [
    fl("fl_visit", { window: "morning", pets: 2 }),
    fl("fl_visit", { window: "morning", pets: 4 }),
    fl("fl_visit", { window: "night", pets: 0 }),
    fl("fl_hatch", {}),
    fl("fl_care", { action: "feed" }),
    fl("fl_care", { action: "feed" }),
    fl("fl_care", { action: "clean" }),
    fl("fl_play_end", { game: "fireflies", score: 10 }),
    fl("fl_form", { form: "cozy" }),
    fl("fl_form", { form: "cozy" }),
    fl("fl_form", { form: "wild" }),
    fl("fl_play_end", { game: "logs", score: 20 }),
    fl("fl_level", { level: 2, stage: "spark" }),
    fl("fl_level", { level: 3, stage: "flicker" }),
    fl("fl_state", { to: "ember" }),
    fl("fl_unlock", { kind: "hat", via: "gift" }),
    fl("fl_unlock", { kind: "hat", via: "gift" }),
    fl("fl_unlock", { kind: "food", via: "level" }),
    fl("fl_buy", { kind: "hat", price: 90 }),
    fl("fl_buy", { kind: "decor", price: 400 }),
    fl("fl_buy", { kind: "hat", price: 50 }),
    fl("fl_happening", { kind: "visitor", done: 0 }),
    fl("fl_happening", { kind: "visitor", done: 1 }),
    fl("fl_happening", { kind: "rain", done: 0 }),
    fl("fl_friend", { action: "add" }),
    fl("fl_friend", { action: "add" }),
    fl("fl_friend", { action: "playdate" }),
    fl("fl_share", { via: "download" }),
    fl("fl_share", { via: "download" }),
    fl("fl_share", { via: "share" }),
  ];
  const summary = summarizeFlamelings(events);

  it("counts visits, hatches and averages", () => {
    expect(summary.visits).toBe(3);
    expect(summary.hatches).toBe(1);
    expect(summary.averagePets).toBe(2);
    expect(summary.averageScore).toBe(15);
    expect(summary.playRuns).toBe(2);
    expect(summary.playGames).toEqual([
      { key: "fireflies", views: 1 },
      { key: "logs", views: 1 },
    ]);
    expect(summary.forms).toEqual([
      { key: "cozy", views: 2 },
      { key: "wild", views: 1 },
    ]);
    expect(summary.visitWindows[0]).toEqual({ key: "morning", views: 2 });
  });

  it("ranks care, stages, states and unlocks", () => {
    expect(summary.care[0]).toEqual({ key: "feed", views: 2 });
    expect(summary.levelUps).toBe(2);
    expect(summary.highestLevel).toBe(3);
    expect(summary.states).toEqual([{ key: "ember", views: 1 }]);
    expect(summary.unlocks[0]).toEqual({ key: "hat · gift", views: 2 });
  });

  it("counts shop purchases, sparks spent and what was bought", () => {
    expect(summary.purchases).toBe(3);
    expect(summary.sparksSpent).toBe(540);
    expect(summary.buys[0]).toEqual({ key: "hat", views: 2 });
  });

  it("counts happenings started and done", () => {
    expect(summary.happeningsDone).toBe(1);
    expect(summary.happenings).toContainEqual({
      key: "visitor · done",
      views: 1,
    });
    expect(summary.happenings).toContainEqual({
      key: "rain · started",
      views: 1,
    });
  });

  it("counts friend actions", () => {
    expect(summary.friends).toEqual([
      { key: "add", views: 2 },
      { key: "playdate", views: 1 },
    ]);
  });

  it("counts shared and saved pictures", () => {
    expect(summary.shares).toEqual([
      { key: "download", views: 2 },
      { key: "share", views: 1 },
    ]);
  });

  it("has empty answers with no events", () => {
    const empty = summarizeFlamelings([]);
    expect(empty.purchases).toBe(0);
    expect(empty.sparksSpent).toBe(0);
    expect(empty.averagePets).toBeNull();
    expect(empty.averageScore).toBeNull();
    expect(empty.highestLevel).toBe(0);
  });
});

describe("summarizeShipwreck", () => {
  const ev = (
    name: GameEvent["name"],
    props: GameEvent["props"]
  ): GameEvent => ({ site: "shipwreck", name, props, day: "2026-11-20" });

  it("counts runs, outcomes, sink times and cameras", () => {
    const summary = summarizeShipwreck([
      ev("shipwreck_start", { mode: "real", opened: 0 }),
      ev("shipwreck_start", { mode: "whatif", opened: 2 }),
      ev("shipwreck_start", { mode: "whatif", opened: 4 }),
      ev("shipwreck_end", { mode: "real", outcome: "sank", minutes: 160 }),
      ev("shipwreck_end", { mode: "whatif", outcome: "sank", minutes: 200 }),
      ev("shipwreck_end", { mode: "whatif", outcome: "floated", minutes: 360 }),
      ev("shipwreck_camera", { camera: "bridge" }),
      ev("shipwreck_camera", { camera: "bridge" }),
      ev("shipwreck_camera", { camera: "orbit" }),
    ]);
    expect(summary.starts).toBe(3);
    expect(summary.modes[0]).toEqual({ key: "whatif", views: 2 });
    // Events before the ship prop are the Titanic's.
    expect(summary.averageOpenedByShip).toEqual([
      { ship: "titanic", average: 3 },
    ]);
    expect(summary.sank).toBe(2);
    expect(summary.floated).toBe(1);
    expect(summary.averageSinkMinutes).toBe(180);
    expect(summary.cameras[0]).toEqual({ key: "bridge", views: 2 });
  });

  it("splits starts and ends by ship, counting a missing ship as the Titanic", () => {
    const summary = summarizeShipwreck([
      ev("shipwreck_start", { mode: "real", opened: 0 }),
      ev("shipwreck_start", { mode: "real", opened: 0, ship: "titanic" }),
      ev("shipwreck_start", { mode: "whatif", opened: 1, ship: "lusitania" }),
      ev("shipwreck_start", { mode: "real", opened: 0, ship: "fitzgerald" }),
      ev("shipwreck_end", { mode: "real", outcome: "sank", minutes: 18 }),
      ev("shipwreck_end", {
        mode: "real",
        outcome: "sank",
        minutes: 20,
        ship: "fitzgerald",
      }),
      ev("shipwreck_end", {
        mode: "whatif",
        outcome: "floated",
        minutes: 30,
        ship: "lusitania",
      }),
    ]);
    expect(summary.ships).toEqual([
      { key: "titanic", views: 2 },
      { key: "fitzgerald", views: 1 },
      { key: "lusitania", views: 1 },
    ]);
    expect(summary.shipEnds).toEqual([
      { key: "fitzgerald · sank", views: 1 },
      { key: "lusitania · floated", views: 1 },
      { key: "titanic · sank", views: 1 },
    ]);
  });

  it("averages What-if openings per ship: compartments, hits and spots apart", () => {
    const summary = summarizeShipwreck([
      ev("shipwreck_start", { mode: "whatif", opened: 4 }),
      ev("shipwreck_start", { mode: "whatif", opened: 2, ship: "titanic" }),
      ev("shipwreck_start", { mode: "whatif", opened: 1, ship: "lusitania" }),
      ev("shipwreck_start", { mode: "whatif", opened: 3, ship: "lusitania" }),
      ev("shipwreck_start", { mode: "whatif", opened: 22, ship: "fitzgerald" }),
      ev("shipwreck_start", { mode: "real", opened: 0, ship: "fitzgerald" }),
    ]);
    expect(summary.averageOpenedByShip).toEqual([
      { ship: "titanic", average: 3 },
      { ship: "lusitania", average: 2 },
      { ship: "fitzgerald", average: 22 },
    ]);
  });

  it("has empty answers with no events", () => {
    const empty = summarizeShipwreck([]);
    expect(empty.starts).toBe(0);
    expect(empty.averageOpenedByShip).toEqual([]);
    expect(empty.averageSinkMinutes).toBeNull();
  });
});
