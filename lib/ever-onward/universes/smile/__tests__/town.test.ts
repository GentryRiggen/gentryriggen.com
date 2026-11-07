import { genericBots } from "../../../engine/bots";
import { performAction, tick } from "../../../engine/engine";
import { simulate, type Strategy } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import {
  buildsFloats,
  holdsPrice,
  minesTown,
  runsStand,
  steersFloats,
  takesFork,
} from "../bots";
import { sceneInfo } from "../scene";
import { incomePerSecond } from "../tick";
import {
  DAY_HOT,
  DAY_RAIN,
  PRICE_DEFS,
  STREETS,
  STREET_COUNT,
  care,
  coinsAt,
  coinsPerSecond,
  crowdAt,
  dayKind,
  floatsOn,
  floatsOwned,
  grumpyCount,
  isGrumpy,
  isMoving,
  isRepainting,
  isTownOpen,
  moodOfStreet,
  priceActionId,
  priceOf,
  routeMult,
  sendActionId,
  streetFall,
  streetRise,
  townMood,
  weightOf,
} from "../town";
import { TUNING } from "../tuning";
import { def, runAtPhaseStart } from "./fixtures";

const T = TUNING.town;

const advance = (run: RunState, seconds: number): RunState => {
  let next = run;
  for (let t = 0; t < seconds; t += 1) next = tick(def, next, 1);
  return next;
};

/** A town with a clown, so the stand and the route are open. */
function openTown(): RunState {
  const start = runAtPhaseStart(1);
  const run = {
    ...start,
    owned: { ...start.owned, clown: 3, band: 2 },
    flags: { ...start.flags },
    resources: { ...start.resources },
  };
  return advance(run, 1);
}

const withDay = (run: RunState, kind: number, street = 0): RunState => ({
  ...run,
  resources: {
    ...run.resources,
    tnDay: kind,
    tnDaySt: street,
    tnDayLeft: 500,
  },
});

describe("The town: the lemonade stand", () => {
  it("opens with the first clown, at a fair price, with a few floats", () => {
    const closed = runAtPhaseStart(1);
    expect(isTownOpen(closed)).toBe(false);
    expect(routeMult(closed)).toBe(1);
    const run = openTown();
    expect(isTownOpen(run)).toBe(true);
    expect(priceOf(run)).toBe(2);
    expect(floatsOwned(run)).toBe(T.startFloats);
  });

  it("brings fewer people the higher the price, and earns coins from the crowd times the price", () => {
    const run = openTown();
    const crowds = PRICE_DEFS.map((_, level) => crowdAt(run, level));
    for (let i = 1; i < crowds.length; i += 1)
      expect(crowds[i]).toBeLessThan(crowds[i - 1]);
    expect(coinsAt(run, 0)).toBe(0);
    expect(coinsAt(run, 2)).toBeGreaterThan(coinsAt(run, 1));
    // The top price brings so few people that it earns less than the middle.
    expect(coinsAt(run, 4)).toBeLessThan(coinsAt(run, 3) * 1.5);
  });

  it("pays the most cheers to a full street and no coins for free lemonade", () => {
    const fair = openTown();
    const free = performAction(def, fair, priceActionId(0));
    const settled = advance(free, T.repaintSeconds + 1);
    expect(priceOf(settled)).toBe(0);
    expect(coinsPerSecond(settled)).toBe(0);
    expect(incomePerSecond(settled)).toBeGreaterThan(incomePerSecond(fair));
    const pricey = advance(
      performAction(def, fair, priceActionId(4)),
      T.repaintSeconds + 1
    );
    expect(coinsPerSecond(pricey)).toBeGreaterThan(coinsPerSecond(settled));
    expect(incomePerSecond(pricey)).toBeLessThan(incomePerSecond(fair));
  });

  it("takes a moment to repaint the sign, and the crowd stays away meanwhile", () => {
    const run = openTown();
    const changed = performAction(def, run, priceActionId(0));
    expect(isRepainting(changed)).toBe(true);
    expect(priceOf(changed)).toBe(2);
    expect(performAction(def, changed, priceActionId(4))).toBe(changed);
    const during = advance(changed, 2);
    expect(coinsPerSecond(during)).toBeLessThan(coinsPerSecond(run));
    const after = advance(changed, T.repaintSeconds + 1);
    expect(isRepainting(after)).toBe(false);
    expect(priceOf(after)).toBe(0);
  });

  it("is moved by the weather: a hot day fills the stand, rain empties it", () => {
    const run = openTown();
    expect(crowdAt(withDay(run, DAY_HOT), 3)).toBeGreaterThan(crowdAt(run, 3));
    expect(crowdAt(withDay(run, DAY_RAIN), 2)).toBeLessThan(crowdAt(run, 2));
    // The price that earns the most coins is higher on a hot day.
    const best = (r: RunState) =>
      [0, 1, 2, 3, 4].reduce((a, b) => (coinsAt(r, b) > coinsAt(r, a) ? b : a));
    expect(best(withDay(run, DAY_HOT))).toBeGreaterThan(best(run));
  });
});

describe("The town: the parade route", () => {
  it("lets a street with no float turn grumpy, and a grumpy street drags the whole town down", () => {
    const run = openTown();
    const empty = [0, 1, 2, 3].find((i) => floatsOn(run, i) === 0)!;
    expect(isGrumpy(run, empty)).toBe(false);
    const later = advance(run, 120);
    expect(isGrumpy(later, empty)).toBe(true);
    expect(grumpyCount(later)).toBeGreaterThan(0);
    const fed = {
      ...later,
      resources: { ...later.resources, [`tnH${empty}`]: 1 },
    };
    expect(routeMult(later)).toBeLessThan(routeMult(fed));
  });

  it("pays less for every float on the same street", () => {
    const gains = [0, 1, 2, 3, 4].map((f) => care(f + 1) - care(f));
    for (let i = 1; i < gains.length; i += 1)
      expect(gains[i]).toBeLessThan(gains[i - 1]);
  });

  it("takes a moment to move a float, one at a time, and the float cheers nobody on the road", () => {
    const run = openTown();
    const to = [0, 1, 2, 3].find((i) => floatsOn(run, i) === 0)!;
    const sent = performAction(def, run, sendActionId(to));
    expect(isMoving(sent)).toBe(true);
    expect(floatsOwned(sent)).toBe(floatsOwned(run));
    const total = (r: RunState) =>
      [0, 1, 2, 3].reduce((n, i) => n + floatsOn(r, i), 0);
    expect(total(sent)).toBe(total(run) - 1);
    expect(performAction(def, sent, sendActionId(to))).toBe(sent);
    const arrived = advance(sent, T.moveSeconds + 1);
    expect(isMoving(arrived)).toBe(false);
    expect(floatsOn(arrived, to)).toBe(floatsOn(run, to) + 1);
    expect(total(arrived)).toBe(total(run));
  });

  it("builds a float with coins, up to a cap, onto the emptiest street", () => {
    const run = {
      ...openTown(),
    };
    run.resources.coins = 1e6;
    const built = performAction(def, run, "rt-buy");
    expect(floatsOwned(built)).toBe(floatsOwned(run) + 1);
    expect(built.resources.coins).toBeLessThan(1e6);
    let full = built;
    for (let n = 0; n < 30; n += 1) full = performAction(def, full, "rt-buy");
    expect(floatsOwned(full)).toBe(T.startFloats + T.floatCosts.length);
  });

  it("makes a party street count for more and rain make its floats worth less", () => {
    const run = openTown();
    expect(weightOf(withDay(run, 3, 2), 2)).toBeGreaterThan(weightOf(run, 2));
    const rainy = withDay(run, DAY_RAIN, 0);
    const after = advance(rainy, 60);
    expect(moodOfStreet(after, 0)).toBeLessThan(moodOfStreet(run, 0) + 1e-9);
  });

  it("cheers a street up faster than it sours", () => {
    const run = openTown();
    expect(streetRise(run)).toBeGreaterThan(streetFall(run));
  });
});

describe("The town: the picture", () => {
  it("encodes the town as flat strings and numbers", () => {
    const run = openTown();
    const info = sceneInfo(run);
    expect(info.price).toBe(2);
    expect(info.crew).toBe("1-1-1-0");
    expect(info.moods).toHaveLength(STREET_COUNT);
    expect(info.moving).toBe(-1);
    for (const value of [info.day, info.crew, info.moods])
      expect(typeof value).toBe("string");
    expect(sceneInfo(runAtPhaseStart(1)).price).toBe(-1);
  });

  it("shows a grumpy street and a float arriving as big moments", () => {
    const run = openTown();
    const grumpy = advance(run, 80);
    expect(sceneInfo(grumpy).moods).toContain("0");
    const empty = [0, 1, 2, 3].find((i) => floatsOn(run, i) === 0)!;
    const arrived = advance(
      performAction(def, run, sendActionId(empty)),
      T.moveSeconds + 1
    );
    expect(sceneInfo(arrived).arrived).toBe(empty);
  });
});

describe("The town: nothing is best for good (simulated)", () => {
  jest.setTimeout(240_000);
  const base = genericBots(def);
  const tapper: Strategy = { ...base.tapper, tapRate: () => 6 };
  const SEEDS = [1, 2, 3];

  type Actions = NonNullable<Strategy["actions"]>;
  const both =
    (...all: Actions[]): Actions =>
    (run, available) =>
      all.flatMap((a) => a(run, available));
  /** Steers only on plain days: one split for good, whatever the weather. */
  const plainSplit: Actions = (run, available) =>
    dayKind(run) === 0 ? steersFloats(10)(run, available) : [];

  const townMinutes = (seed: number, actions: Actions): number => {
    const entry = simulate(def, {
      maxSeconds: 8 * 3600,
      step: 1,
      seed,
      strategy: base.tapper,
      stopWhen: (r) => r.phase >= 1,
    }).finalRun;
    const done = simulate(def, {
      maxSeconds: 8 * 3600,
      step: 1,
      startRun: entry,
      stopWhen: (r) => r.phase > 1,
      strategy: { ...tapper, actions: both(takesFork(), actions) },
    });
    return (done.endTime - entry.time) / 60;
  };
  const mean = (actions: Actions): number =>
    SEEDS.reduce((sum, seed) => sum + townMinutes(seed, actions), 0) /
    SEEDS.length;

  const results: Record<string, number> = {};
  beforeAll(() => {
    results.adjusts = mean(minesTown());
    results.fair = mean(both(buildsFloats));
    for (const level of [0, 1, 3, 4])
      results[`price${level}`] = mean(both(buildsFloats, holdsPrice(level)));
    results.evenSplit = mean(both(buildsFloats, runsStand()));
    results.plainSplit = mean(both(buildsFloats, runsStand(), plainSplit));
  });

  it("finishes the town sooner by adjusting the price than at any one price", () => {
    for (const fixed of [
      results.fair,
      results.price0,
      results.price1,
      results.price3,
      results.price4,
    ])
      expect(results.evenSplit).toBeLessThan(fixed);
  });

  it("finishes sooner by moving floats with the day than with one split for good", () => {
    expect(results.adjusts).toBeLessThan(results.evenSplit);
    expect(results.adjusts).toBeLessThan(results.plainSplit);
  });

  it("never lets one end of the price win: free is far slower, pricey slower still than fair", () => {
    expect(results.price0).toBeGreaterThan(results.fair * 1.2);
    expect(results.price4).toBeGreaterThan(results.fair);
  });

  it("plays sensibly: the bots keep every street fed on the whole", () => {
    const entry = runAtPhaseStart(1);
    const run = simulate(def, {
      maxSeconds: 8 * 3600,
      step: 1,
      startRun: entry,
      stopWhen: (r) => r.time - entry.time > 15 * 60,
      strategy: { ...tapper, actions: both(takesFork(), minesTown()) },
    }).finalRun;
    expect(floatsOwned(run)).toBeGreaterThan(T.startFloats);
    expect(townMood(run)).toBeGreaterThan(0.3);
    expect(STREETS.length).toBe(STREET_COUNT);
  });
});
