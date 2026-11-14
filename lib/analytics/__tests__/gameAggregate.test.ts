import type { GameEvent } from "../gameEvents";
import { summarizePlane, summarizeShip } from "../gameAggregate";

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
