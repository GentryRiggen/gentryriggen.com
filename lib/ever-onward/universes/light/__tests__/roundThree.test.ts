import {
  greetVisitor,
  metVisitors,
  newRun,
  TEASER_READY_HINT,
  teaserHint,
  tick,
  visibleTeasers,
  waitingVisitors,
} from "../../../engine/engine";
import type { RunState } from "../../../engine/types";
import { def } from "./fixtures";
import { lanternOf, sceneInfo } from "../scene";
import {
  collectorEnergyPerSecond,
  gridFactor,
  isFleetGlowing,
  isGridGlowing,
  resolvePerSecond,
  starsPerSecond,
  steerBonus,
} from "../tick";
import { lightCountdown } from "../visitors";

const idle = (run: RunState, seconds: number): RunState => {
  let next = run;
  for (let t = 0; t < seconds; t += 1) next = tick(def, next, 1);
  return next;
};

const withOwned = (run: RunState, owned: Record<string, number>): RunState => ({
  ...run,
  owned: { ...run.owned, ...owned },
});

describe("visitors", () => {
  it("arrive on a milestone, never on a timer", () => {
    const quiet = idle(newRun(def), 3 * 3600);
    expect(waitingVisitors(def, quiet)).toHaveLength(0);
    const grown = tick(def, withOwned(quiet, { keeper: 6 }), 1);
    expect(waitingVisitors(def, grown).map((v) => v.id)).toEqual([
      "visitor-mail",
    ]);
    // the line it arrives with is in the story
    expect(grown.story).toContain("visitor-mail");
  });

  it("wait as long as it takes, and give their gift once", () => {
    const here = tick(def, withOwned(newRun(def), { keeper: 6 }), 1);
    const waited = idle(here, 2 * 3600);
    expect(waitingVisitors(def, waited)).toHaveLength(1);
    const greeted = greetVisitor(def, waited, "visitor-mail");
    expect(greeted.resources.coins).toBeGreaterThan(waited.resources.coins);
    expect(waitingVisitors(def, greeted)).toHaveLength(0);
    expect(metVisitors(def, greeted).map((v) => v.id)).toEqual([
      "visitor-mail",
    ]);
    // a second hello is a no-op, so the gift can't be farmed
    expect(greetVisitor(def, greeted, "visitor-mail")).toBe(greeted);
  });

  it("pay a late hello in the currency of the part they are greeted in", () => {
    const here = tick(def, withOwned(newRun(def), { keeper: 6 }), 1);
    const later: RunState = {
      ...here,
      phase: 2,
      resources: { ...here.resources, energy: 0, coins: 5 },
      owned: { ...here.owned, aim: 2, collector: 3 },
    };
    const greeted = greetVisitor(def, later, "visitor-mail");
    expect(greeted.resources.coins).toBe(5);
    expect(greeted.resources.energy).toBeGreaterThan(0);
  });

  it("only come in their own phase", () => {
    const run = tick(def, withOwned(newRun(def), { collector: 6 }), 1);
    expect(waitingVisitors(def, run)).toHaveLength(0);
  });

  it("bring a small gift: at most about 15 seconds of income", () => {
    const here = tick(def, withOwned(newRun(def), { keeper: 6 }), 1);
    const gift =
      greetVisitor(def, here, "visitor-mail").resources.coins -
      here.resources.coins;
    expect(gift).toBeGreaterThan(0);
    const perSecond = gift / 15;
    // a minute of the same play earns far more than the gift
    expect(perSecond * 60).toBeGreaterThan(gift * 2);
  });
});

describe("someday cards", () => {
  it("show a hint, and go away when the upgrade pops in", () => {
    const early = withOwned(newRun(def), { lens: 4 });
    expect(visibleTeasers(def, early).map((t) => t.upgradeId)).toContain(
      "lighthouse"
    );
    const popped = { ...early, revealed: [...early.revealed, "lighthouse"] };
    expect(visibleTeasers(def, popped).map((t) => t.upgradeId)).not.toContain(
      "lighthouse"
    );
  });

  it("say the goal is met when only a full shop holds the upgrade back", () => {
    const teaser = (def.teasers ?? []).find(
      (t) => t.upgradeId === "lighthouse"
    )!;
    const early = withOwned(newRun(def), { lens: 4 });
    expect(teaserHint(def, early, teaser)).toBe(teaser.hint(early));
    const ready = withOwned(newRun(def), { lens: 4, keeper: 3 });
    expect(teaserHint(def, ready, teaser)).toBe(TEASER_READY_HINT);
  });

  it("only hint at upgrades that exist", () => {
    const ids = new Set(def.upgrades.map((u) => u.id));
    for (const teaser of def.teasers ?? [])
      expect(ids.has(teaser.upgradeId)).toBe(true);
  });
});

describe("the sky's star countdown", () => {
  it("is only in the sky, and ticks mark where the relays wake", () => {
    expect(lightCountdown(newRun(def))).toBeNull();
    const sky = { ...newRun(def), phase: 2 };
    const view = lightCountdown({
      ...sky,
      resources: { ...sky.resources, stars: 800 },
    });
    expect(view?.value).toBe(800);
    expect(view?.marks).toEqual([700, 350]);
    expect(view?.detail).toMatch(/700/);
  });
});

const night = (resources: Record<string, number>): RunState => {
  const run = { ...newRun(def), phase: 1 };
  return {
    ...run,
    owned: { gen1: 5, gen2: 3 },
    resources: { ...run.resources, ...resources },
  };
};

describe("the steady glow", () => {
  it("pays the cities 15% more while the grid is steady, and only then", () => {
    const steady = night({ grid: 80 });
    const wobbly = night({ grid: 70 });
    expect(isGridGlowing(steady)).toBe(true);
    expect(isGridGlowing(wobbly)).toBe(false);
    const steadyPay = gridFactor(steady);
    // the same steadiness without the glow would pay this much
    expect(steadyPay / (0.6 + 0.4 * 0.8)).toBeCloseTo(1.15, 5);
    expect(sceneInfo(steady).glow).toBe(1);
    expect(sceneInfo(wobbly).glow).toBe(0);
  });

  it("is never a tax: the worst a neglected grid pays is the old floor", () => {
    expect(gridFactor(night({ grid: 0 }))).toBeCloseTo(0.6, 5);
  });

  it("speeds the fleet up 15% while it flies true", () => {
    const sky = (heading: number): RunState => {
      const run = { ...newRun(def), phase: 2 };
      return {
        ...run,
        resources: { ...run.resources, probes: 50, heading },
      };
    };
    expect(isFleetGlowing(sky(90))).toBe(true);
    expect(isFleetGlowing(sky(60))).toBe(false);
    const ratio =
      starsPerSecond(sky(75)) /
      starsPerSecond({
        ...sky(75),
        resources: { ...sky(75).resources, heading: 74.9 },
      });
    expect(ratio).toBeGreaterThan(1.15);
  });
});

describe("collectors come in six bigger steps", () => {
  it("max out at 6 and are worth as much in total as ten small ones were", () => {
    const collector = def.upgrades.find((u) => u.id === "collector")!;
    expect(collector.maxLevel).toBe(6);
    const run = { ...newRun(def), phase: 2, owned: { collector: 6 } };
    expect(collectorEnergyPerSecond(run)).toBeCloseTo(10, 5);
  });
});

describe("steering the boat earns resolve", () => {
  const boat = (heading: number, lights = 2): RunState => {
    const run = { ...newRun(def), phase: 3 };
    return {
      ...run,
      resources: {
        ...run.resources,
        lights,
        boatHeading: heading,
        boatProgress: 10,
      },
    };
  };

  it("is 1.5x when true, fades to 1x, and is never below 1x", () => {
    expect(steerBonus(boat(100))).toBeCloseTo(1.5, 5);
    expect(steerBonus(boat(80))).toBeCloseTo(1.5, 5);
    expect(steerBonus(boat(60))).toBeCloseTo(1.25, 5);
    expect(steerBonus(boat(40))).toBe(1);
    expect(steerBonus(boat(0))).toBe(1);
  });

  it("only counts while the boat is out and still sailing", () => {
    expect(steerBonus(boat(100, 6))).toBe(1);
    const arrived = boat(100);
    arrived.resources.boatProgress = 100;
    expect(steerBonus(arrived)).toBe(1);
  });

  it("makes letting go faster for a player who steers", () => {
    expect(resolvePerSecond(boat(100))).toBeGreaterThan(
      resolvePerSecond(boat(0)) * 1.4
    );
  });
});

describe("the lantern", () => {
  it("is the first colour until one is picked, and ignores odd values", () => {
    const run = newRun(def);
    expect(lanternOf(run)).toBe(1);
    const pick = (lantern: number): RunState => ({
      ...run,
      resources: { ...run.resources, lantern },
    });
    expect(lanternOf(pick(3))).toBe(3);
    expect(lanternOf(pick(9))).toBe(1);
    expect(lanternOf(pick(-2))).toBe(1);
    expect(sceneInfo(pick(2)).lantern).toBe(2);
  });
});
