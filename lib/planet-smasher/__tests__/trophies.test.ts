import { freshProgress, freshStats, type Progress } from "../progress";
import {
  TROPHIES,
  newlyEarned,
  progressToward,
  type PlanetRun,
  type TrophyId,
} from "../trophies";
import { TOOL_ORDER, type EndingKind } from "../tools";

const withStats = (
  stats: Partial<Progress["stats"]>,
  rest: Partial<Progress> = {}
): Progress => {
  const p = freshProgress();
  return { ...p, ...rest, stats: { ...freshStats(), ...stats } };
};
const has = (p: Progress, id: TrophyId) =>
  newlyEarned(p, null, null).includes(id);
const ended = (ending: EndingKind = "shatter") => ({
  ending,
  planetId: "earth" as const,
  at: 0,
});
const run = (...toolsUsed: PlanetRun["toolsUsed"]): PlanetRun => ({
  toolsUsed,
  startedAt: 0,
});

describe("trophies", () => {
  it("lists 20 in table order", () => {
    expect(TROPHIES).toHaveLength(20);
    expect(TROPHIES[0].id).toBe("firstSmash");
  });

  it.each([
    ["firstSmash", { planetsEnded: 1 }, { planetsEnded: 0 }],
    ["smash10", { planetsEnded: 10 }, { planetsEnded: 9 }],
    ["smash50", { planetsEnded: 50 }, { planetsEnded: 49 }],
    [
      "nuke25",
      { shots: { nuke: 20, nukeTwin: 4, nukeRain: 1 } },
      { shots: { nuke: 24 } },
    ],
    ["nuke100", { shots: { nuke: 50, nukeRain: 50 } }, { shots: { nuke: 99 } }],
    ["combo10", { bestCombo: 10 }, { bestCombo: 9 }],
    ["mars", { endedByPlanet: { mars: 1 } }, { endedByPlanet: { ice: 1 } }],
    ["frostia", { endedByPlanet: { ice: 1 } }, { endedByPlanet: { mars: 1 } }],
    ["blackHole", { endedBy: { swallowed: 1 } }, { endedBy: { shatter: 1 } }],
    ["monster", { shots: { monster: 10 } }, { shots: { monster: 9 } }],
    ["sunDive", { endedBy: { vaporized: 1 } }, {}],
    ["collision", { endedBy: { collided: 1 } }, {}],
    ["speedy", { fastestEndMs: 20000 }, { fastestEndMs: 20001 }],
    [
      "billions",
      { peopleLost: 100_000_000_000 },
      { peopleLost: 99_999_999_999 },
    ],
    [
      "aliens",
      {
        shots: {
          alienLaser: 1,
          ufoSwarm: 1,
          gravityBeam: 1,
          nanobots: 1,
          mothership: 1,
        },
      },
      { shots: { alienLaser: 1, ufoSwarm: 1, gravityBeam: 1, nanobots: 1 } },
    ],
  ] as [TrophyId, Partial<Progress["stats"]>, Partial<Progress["stats"]>][])(
    "%s earns at its threshold, not below",
    (id, at, below) => {
      expect(has(withStats(at), id)).toBe(true);
      expect(has(withStats(below), id)).toBe(false);
    }
  );

  it("speedy needs a recorded time", () => {
    expect(has(withStats({ fastestEndMs: null }), "speedy")).toBe(false);
  });

  it("stars10k and allEndings read progress", () => {
    expect(has(withStats({}, { points: 10000 }), "stars10k")).toBe(true);
    expect(has(withStats({}, { points: 9999 }), "stars10k")).toBe(false);
    const all: EndingKind[] = [
      "shatter",
      "molten",
      "frozen",
      "consumed",
      "swallowed",
      "vaporized",
      "collided",
    ];
    expect(has(withStats({}, { endingsSeen: all }), "allEndings")).toBe(true);
    expect(
      has(withStats({}, { endingsSeen: all.slice(1) }), "allEndings")
    ).toBe(false);
  });

  it("everyTool needs a shot with every tool", () => {
    const shots = Object.fromEntries(TOOL_ORDER.map((t) => [t, 1]));
    expect(has(withStats({ shots }), "everyTool")).toBe(true);
    delete shots.tsunami;
    expect(has(withStats({ shots }), "everyTool")).toBe(false);
  });

  it("meteorsOnly and laserOnly look at the ended planet's run", () => {
    const p = withStats({});
    const e = (r: PlanetRun | null) => newlyEarned(p, r, ended());
    expect(e(run("asteroid", "meteorShower"))).toContain("meteorsOnly");
    expect(e(run("asteroid"))).toContain("meteorsOnly");
    expect(e(run("asteroid", "nuke"))).not.toContain("meteorsOnly");
    expect(e(run("alienLaser"))).toContain("laserOnly");
    expect(e(run("alienLaser", "asteroid"))).not.toContain("laserOnly");
    expect(e(run())).not.toContain("meteorsOnly");
    expect(e(run())).not.toContain("laserOnly");
    expect(e(null)).toEqual([]);
    expect(newlyEarned(p, run("asteroid"), null)).not.toContain("meteorsOnly");
  });

  it("never returns a trophy already held", () => {
    const p = withStats({ planetsEnded: 1 }, { trophies: ["firstSmash"] });
    expect(newlyEarned(p, null, null)).toEqual([]);
  });

  it("progressToward counts goals", () => {
    const p = withStats({ shots: { nuke: 2, nukeTwin: 3, nukeRain: 4 } });
    expect(progressToward("nuke25", p)).toBe(9);
    expect(progressToward("firstSmash", p)).toBeNull();
  });
});
